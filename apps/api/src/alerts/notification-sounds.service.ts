import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { In, Repository } from 'typeorm';
import { NotificationSound } from './entities/notification-sound.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';

const INTERNAL_ROLES = new Set(['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer']);
const SOUND_MANAGER_ROLES = new Set(['super_admin', 'admin', 'ops']);
const MAX_FILE_BYTES = 900 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface NotificationSoundMetadata {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  durationMs: number;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationSoundsService {
  constructor(
    @InjectRepository(NotificationSound) private readonly repo: Repository<NotificationSound>,
    private readonly orgPerms: OrgPermissionsService,
    private readonly rolePerms: RolePortalPermissionsService,
  ) {}

  async list(user: User, includeInactive = false): Promise<NotificationSoundMetadata[]> {
    await this.assertCanRead(user);
    const canSeeInactive = SOUND_MANAGER_ROLES.has(user.role) && includeInactive;
    const sounds = await this.repo.find({
      where: canSeeInactive ? {} : { isActive: true },
      order: { createdAt: 'DESC' },
      select: { id: true, name: true, fileName: true, mimeType: true, durationMs: true, isActive: true, createdAt: true },
    });
    return sounds;
  }

  async getAudio(user: User, id: string): Promise<{ metadata: NotificationSoundMetadata; data: Buffer }> {
    await this.assertCanRead(user);
    const sound = await this.repo.createQueryBuilder('sound')
      .addSelect('sound.fileData')
      .where('sound.id = :id', { id })
      .andWhere('sound.isActive = TRUE')
      .getOne();
    if (!sound) throw new NotFoundException('Notification sound not found');
    return { metadata: sound, data: sound.fileData };
  }

  async create(user: User, name: unknown, file?: { buffer?: Buffer; size?: number }): Promise<NotificationSoundMetadata> {
    this.assertCanManage(user);
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60 || /[\u0000-\u001f]/.test(name)) {
      throw new BadRequestException('Enter a sound name between 2 and 60 characters');
    }
    if (!file?.buffer?.length || !Buffer.isBuffer(file.buffer) || file.buffer.length > MAX_FILE_BYTES) {
      throw new BadRequestException('Upload a WAV sound smaller than 900 KB');
    }
    const durationMs = this.validateWav(file.buffer);
    const id = randomUUID();
    const sound = this.repo.create({
      id,
      name: name.trim(),
      fileName: `tv_${id.replaceAll('-', '')}.wav`,
      mimeType: 'audio/wav',
      durationMs,
      fileData: file.buffer,
      isActive: true,
      createdBy: user.id,
    });
    const saved = await this.repo.save(sound);
    return this.toMetadata(saved);
  }

  async setActive(user: User, id: string, active: unknown): Promise<NotificationSoundMetadata> {
    this.assertCanManage(user);
    if (typeof active !== 'boolean') throw new BadRequestException('Status must be active or inactive');
    const sound = await this.repo.findOne({ where: { id } });
    if (!sound) throw new NotFoundException('Notification sound not found');
    sound.isActive = active;
    return this.toMetadata(await this.repo.save(sound));
  }

  async validateDynamicSoundIds(rawIds: unknown): Promise<string[]> {
    if (rawIds === undefined || rawIds === null) return [];
    if (!Array.isArray(rawIds) || rawIds.length > 100 || rawIds.some(id => typeof id !== 'string' || !UUID_RE.test(id))) {
      throw new BadRequestException('Dynamic sound IDs are invalid');
    }
    const ids = [...new Set(rawIds as string[])];
    if (!ids.length) return [];
    const active = await this.repo.find({ where: { id: In(ids), isActive: true }, select: { id: true } });
    return active.map(sound => sound.id);
  }

  private async assertCanRead(user: User): Promise<void> {
    if (INTERNAL_ROLES.has(user.role)) return;
    if (!user.organizationId) throw new ForbiddenException('Alerts access is required');
    const [rolePermissions, orgPermission] = await Promise.all([
      this.rolePerms.findAll(),
      this.orgPerms.findByUser(user.id),
    ]);
    const roleCanView = rolePermissions[user.role]?.alerts?.includes('view')
      ?? ['client_owner', 'client_super_admin'].includes(user.role);
    if (orgPermission ? !orgPermission.alertsView : !roleCanView) {
      throw new ForbiddenException('Alerts access is required');
    }
  }

  private assertCanManage(user: User): void {
    if (!SOUND_MANAGER_ROLES.has(user.role)) throw new ForbiddenException('Notification sound management is restricted');
  }

  private toMetadata(sound: NotificationSound): NotificationSoundMetadata {
    return {
      id: sound.id,
      name: sound.name,
      fileName: sound.fileName,
      mimeType: sound.mimeType,
      durationMs: sound.durationMs,
      isActive: sound.isActive,
      createdAt: sound.createdAt,
    };
  }

  private validateWav(data: Buffer): number {
    if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
      throw new BadRequestException('Only PCM WAV audio is supported');
    }
    let offset = 12;
    let byteRate = 0;
    let dataLength = 0;
    let validFormat = false;
    while (offset + 8 <= data.length) {
      const chunkName = data.toString('ascii', offset, offset + 4);
      const chunkSize = data.readUInt32LE(offset + 4);
      const body = offset + 8;
      if (chunkSize > data.length - body) throw new BadRequestException('The WAV file is malformed');
      if (chunkName === 'fmt ') {
        if (chunkSize < 16) throw new BadRequestException('The WAV format is unsupported');
        const format = data.readUInt16LE(body);
        const channels = data.readUInt16LE(body + 2);
        const sampleRate = data.readUInt32LE(body + 4);
        byteRate = data.readUInt32LE(body + 8);
        const bitsPerSample = data.readUInt16LE(body + 14);
        validFormat = format === 1 && (channels === 1 || channels === 2) && sampleRate >= 8000 && sampleRate <= 48000 && bitsPerSample === 16;
      } else if (chunkName === 'data') {
        dataLength = chunkSize;
      }
      offset = body + chunkSize + (chunkSize % 2);
    }
    if (!validFormat || byteRate <= 0 || dataLength <= 0) throw new BadRequestException('Use 16-bit PCM WAV audio with 1 or 2 channels');
    const durationMs = Math.round(dataLength / byteRate * 1000);
    if (durationMs < 200 || durationMs > 30000) throw new BadRequestException('Sound duration must be between 0.2 and 30 seconds');
    return durationMs;
  }
}
