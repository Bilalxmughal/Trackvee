import { BadRequestException, ForbiddenException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, Repository } from 'typeorm';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { INTERNAL_ROLES, assertClientFeatureAccess } from '../org-permissions/client-feature-access.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { User } from '../users/entities/user.entity.js';
import { ReportParams, ReportResult, ReportType, ReportsService } from './reports.service.js';
import { ScheduledReport } from './entities/scheduled-report.entity.js';
import { Geofence } from '../geofences/entities/geofence.entity.js';

export type ScheduledReportPeriod = 'daily_window' | 'yesterday' | 'last_24_hours' | 'last_7_days' | 'this_month';
const REPORT_TYPES = new Set<ReportType>([
  'travel_summary', 'stops_move_summary', 'stoppage_summary', 'move_summary', 'ignition_on_off', 'overspeed',
  'overspeed_summary', 'underspeed', 'daily_travel', 'vehicle_history', 'alert_history', 'driver_behavior', 'geofence_activity',
]);
const PERIODS = new Set<ScheduledReportPeriod>(['daily_window', 'yesterday', 'last_24_hours', 'last_7_days', 'this_month']);
const PKT = 'Asia/Karachi';
const DAY_MS = 24 * 60 * 60 * 1000;

function pktParts(value: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: PKT, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  const get = (key: string) => Number(parts.find(part => part.type === key)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

function pktWallTimeToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute));
}

function nextDailyRun(after: Date, timePkt: string): Date {
  const [hour, minute] = timePkt.split(':').map(Number);
  const today = pktParts(after);
  let next = pktWallTimeToUtc(today.year, today.month, today.day, hour!, minute!);
  if (next.getTime() <= after.getTime()) {
    const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
    next = pktWallTimeToUtc(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(), hour!, minute!);
  }
  return next;
}

function periodRange(period: ScheduledReportPeriod, now: Date, reportFromTime?: string | null, reportToTime?: string | null): { from: Date; to: Date } {
  if (period === 'daily_window' && reportFromTime && reportToTime) {
    const pkt = pktParts(now);
    const [fromHour, fromMinute] = reportFromTime.split(':').map(Number);
    const [toHour, toMinute] = reportToTime.split(':').map(Number);
    return {
      from: pktWallTimeToUtc(pkt.year, pkt.month, pkt.day, fromHour!, fromMinute!),
      to: pktWallTimeToUtc(pkt.year, pkt.month, pkt.day, toHour!, toMinute!),
    };
  }
  if (period === 'last_24_hours') return { from: new Date(now.getTime() - DAY_MS), to: now };
  if (period === 'last_7_days') return { from: new Date(now.getTime() - 7 * DAY_MS), to: now };
  const pkt = pktParts(now);
  const startToday = pktWallTimeToUtc(pkt.year, pkt.month, pkt.day, 0, 0);
  if (period === 'yesterday') return { from: new Date(startToday.getTime() - DAY_MS), to: new Date(startToday.getTime() - 1) };
  return { from: pktWallTimeToUtc(pkt.year, pkt.month, 1, 0, 0), to: now };
}

function cleanParams(raw: Record<string, unknown>): Record<string, unknown> {
  const ids = Array.isArray(raw.vehicleIds) ? raw.vehicleIds : typeof raw.vehicleIds === 'string' ? raw.vehicleIds.split(',') : [];
  const params: Record<string, unknown> = { vehicleIds: [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length <= 64))] };
  for (const key of ['speedLimit', 'minSpeedKmh', 'minStopMin'] as const) {
    const value = Number(raw[key]);
    if (raw[key] !== undefined && raw[key] !== '' && Number.isFinite(value) && value >= 0) params[key] = value;
  }
  if (Array.isArray(raw.geofenceIds)) params['geofenceIds'] = [...new Set(raw.geofenceIds.filter((id): id is string => typeof id === 'string' && id.length <= 64))];
  if (raw.groupBy === 'day' || raw.groupBy === 'week' || raw.groupBy === 'month') params['groupBy'] = raw.groupBy;
  return params;
}

@Injectable()
export class ScheduledReportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduledReportsService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private processing = false;

  constructor(
    @InjectRepository(ScheduledReport) private readonly schedules: Repository<ScheduledReport>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Geofence) private readonly geofences: Repository<Geofence>,
    private readonly reports: ReportsService,
    private readonly orgPermissions: OrgPermissionsService,
    private readonly rolePermissions: RolePortalPermissionsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => { void this.processDue(); }, 60_000);
    this.timer.unref?.();
    void this.processDue();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  isDeliveryConfigured(): boolean {
    return !!process.env['RESEND_API_KEY'] && !!process.env['REPORT_EMAIL_FROM'];
  }

  async listForUser(userId: string, orgId: string | null) {
    const query = this.schedules.createQueryBuilder('schedule').where('schedule.user_id = :userId', { userId });
    if (orgId) query.andWhere('schedule.org_id = :orgId', { orgId });
    else query.andWhere('schedule.org_id IS NULL');
    const rows = await query.orderBy('schedule.created_at', 'DESC').getMany();
    return rows.map(row => ({
      id: row.id, title: row.title, reportType: row.reportType, period: row.period, timePkt: row.timePkt,
      reportFromTime: row.reportFromTime, reportToTime: row.reportToTime, recipientEmails: row.recipientEmails,
      active: row.active, nextRunAt: row.nextRunAt, lastAttemptAt: row.lastAttemptAt,
      lastSentAt: row.lastSentAt, lastError: row.lastError, createdAt: row.createdAt,
    }));
  }

  async create(user: User, orgId: string | null, input: {
    title: string; reportType: string; params: Record<string, unknown>; period: string; timePkt: string;
    reportFromTime?: string; reportToTime?: string; recipientEmails?: string[];
  }): Promise<ScheduledReport> {
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 120) throw new BadRequestException('Enter a report title up to 120 characters');
    if (!input.params || typeof input.params !== 'object' || Array.isArray(input.params)) throw new BadRequestException('Report filters are invalid');
    if (!REPORT_TYPES.has(input.reportType as ReportType)) throw new BadRequestException('Unknown report type');
    if (!PERIODS.has(input.period as ScheduledReportPeriod)) throw new BadRequestException('Choose a supported report period');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.timePkt)) throw new BadRequestException('Choose a valid daily delivery time');
    const dailyWindow = input.period === 'daily_window';
    if (dailyWindow && (!this.validTime(input.reportFromTime) || !this.validTime(input.reportToTime))) throw new BadRequestException('Choose valid report start and end times');
    if (dailyWindow && input.reportFromTime! >= input.reportToTime!) throw new BadRequestException('Report end time must be after its start time');
    if (dailyWindow && input.timePkt <= input.reportToTime!) throw new BadRequestException('Delivery time must be after the report end time');
    const recipients = this.cleanRecipients(input.recipientEmails);
    const params = cleanParams(input.params ?? {});
    const vehicleIds = params['vehicleIds'] as string[];
    if (vehicleIds.length === 0) throw new BadRequestException('Select at least one vehicle');
    if (vehicleIds.length > 250) throw new BadRequestException('A scheduled report can include up to 250 vehicles');
    await this.assertReportGrant(user, orgId, vehicleIds, params['geofenceIds'] as string[] | undefined);
    const now = new Date();
    return this.schedules.save(this.schedules.create({
      userId: user.id, orgId, title: input.title.trim(), reportType: input.reportType,
      params, recipientEmails: recipients, period: input.period, timePkt: input.timePkt,
      reportFromTime: dailyWindow ? input.reportFromTime! : null,
      reportToTime: dailyWindow ? input.reportToTime! : null,
      active: true,
      nextRunAt: nextDailyRun(now, input.timePkt), lastAttemptAt: null, lastSentAt: null, lastError: null,
    }));
  }

  private validTime(value: unknown): value is string {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  private cleanRecipients(raw: unknown): string[] {
    if (raw === undefined) return [];
    if (!Array.isArray(raw) || raw.length > 10) throw new BadRequestException('Enter up to 10 recipient email addresses');
    const recipients = [...new Set(raw.map(value => typeof value === 'string' ? value.trim().toLowerCase() : ''))];
    if (recipients.some(email => !/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email) || email.length > 254)) {
      throw new BadRequestException('Enter valid recipient email addresses');
    }
    return recipients;
  }

  async update(user: User, orgId: string | null, id: string, changes: {
    active?: boolean; title?: string; timePkt?: string; period?: string;
    reportFromTime?: string | null; reportToTime?: string | null;
    recipientEmails?: string[]; reportType?: string; params?: Record<string, unknown>;
  }) {
    const row = await this.findOwned(user, orgId, id);
    if (changes.active !== undefined && typeof changes.active !== 'boolean') throw new BadRequestException('Schedule status must be active or paused');
    if (changes.title !== undefined) {
      if (typeof changes.title !== 'string' || !changes.title.trim() || changes.title.trim().length > 120) throw new BadRequestException('Enter a report title up to 120 characters');
      row.title = changes.title.trim();
    }
    if (changes.timePkt !== undefined) {
      if (!this.validTime(changes.timePkt)) throw new BadRequestException('Choose a valid daily delivery time');
      row.timePkt = changes.timePkt;
    }
    if (changes.period !== undefined) {
      if (!PERIODS.has(changes.period as ScheduledReportPeriod)) throw new BadRequestException('Choose a supported report period');
      row.period = changes.period;
    }
    if (changes.reportFromTime !== undefined) row.reportFromTime = changes.reportFromTime;
    if (changes.reportToTime !== undefined) row.reportToTime = changes.reportToTime;
    if (changes.recipientEmails !== undefined) row.recipientEmails = this.cleanRecipients(changes.recipientEmails);
    if (changes.reportType !== undefined || changes.params !== undefined) {
      if (changes.reportType === undefined || changes.params === undefined) throw new BadRequestException('Report type and filters must be updated together');
      if (!REPORT_TYPES.has(changes.reportType as ReportType)) throw new BadRequestException('Unknown report type');
      if (!changes.params || typeof changes.params !== 'object' || Array.isArray(changes.params)) throw new BadRequestException('Report filters are invalid');
      const params = cleanParams(changes.params);
      const vehicleIds = params['vehicleIds'] as string[];
      if (vehicleIds.length === 0) throw new BadRequestException('Select at least one vehicle');
      if (vehicleIds.length > 250) throw new BadRequestException('A scheduled report can include up to 250 vehicles');
      await this.assertReportGrant(user, orgId, vehicleIds, params['geofenceIds'] as string[] | undefined);
      row.reportType = changes.reportType;
      row.params = params;
    }
    if (row.period === 'daily_window') {
      if (!this.validTime(row.reportFromTime) || !this.validTime(row.reportToTime)) throw new BadRequestException('Choose valid report start and end times');
      if (row.reportFromTime >= row.reportToTime) throw new BadRequestException('Report end time must be after its start time');
      if (row.timePkt <= row.reportToTime) throw new BadRequestException('Delivery time must be after the report end time');
    } else {
      row.reportFromTime = null;
      row.reportToTime = null;
    }
    if (changes.active !== undefined) {
      row.active = changes.active;
      if (changes.active) row.lastError = null;
    }
    if (row.active && (changes.active === true || changes.timePkt !== undefined)) row.nextRunAt = nextDailyRun(new Date(), row.timePkt);
    return this.schedules.save(row);
  }

  async remove(user: User, orgId: string | null, id: string): Promise<void> {
    const row = await this.findOwned(user, orgId, id);
    await this.schedules.remove(row);
  }

  private async findOwned(user: User, orgId: string | null, id: string): Promise<ScheduledReport> {
    const row = await this.schedules.findOne({ where: { id, userId: user.id } });
    if (!row || row.orgId !== orgId) throw new ForbiddenException();
    return row;
  }

  private async assertReportGrant(user: User, orgId: string | null, vehicleIds: string[], geofenceIds: string[] = []): Promise<void> {
    if (INTERNAL_ROLES.has(user.role)) return;
    if (!orgId || user.organizationId !== orgId) throw new ForbiddenException('Organization access required');
    await assertClientFeatureAccess(user, 'reports', 'view', this.orgPermissions, this.rolePermissions);
    const grant = await this.orgPermissions.findByUser(user.id);
    if (grant && grant.orgId !== orgId) throw new ForbiddenException();
    if (grant?.vehicleIds !== null && grant?.vehicleIds !== undefined && vehicleIds.some(id => !grant.vehicleIds!.includes(id))) {
      throw new ForbiddenException('Scheduled report vehicle access is not permitted');
    }
    if (geofenceIds.length) {
      const scoped = await this.geofences.find({ where: { id: In(geofenceIds), orgId }, select: { id: true } });
      if (scoped.length !== geofenceIds.length) throw new ForbiddenException('Scheduled report geofence access is not permitted');
    }
  }

  private async processDue(): Promise<void> {
    if (this.processing || !this.isDeliveryConfigured()) return;
    this.processing = true;
    try {
      const now = new Date();
      const due = await this.schedules.find({ where: { active: true, nextRunAt: LessThanOrEqual(now) }, order: { nextRunAt: 'ASC' }, take: 5 });
      for (const schedule of due) await this.deliver(schedule, now);
    } catch (error) {
      this.logger.error(`Scheduled report polling failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      this.processing = false;
    }
  }

  private async deliver(schedule: ScheduledReport, now: Date): Promise<void> {
    const nextRunAt = nextDailyRun(now, schedule.timePkt);
    const claim = await this.schedules.createQueryBuilder().update(ScheduledReport)
      .set({ nextRunAt, lastAttemptAt: now, lastError: null })
      .where('id = :id AND active = TRUE AND next_run_at <= :now', { id: schedule.id, now })
      .execute();
    if (claim.affected !== 1) return;

    try {
      const user = await this.users.findOne({ where: { id: schedule.userId } });
      if (!user || !user.isActive || (schedule.orgId && user.organizationId !== schedule.orgId) || !user.email) {
        await this.schedules.update(schedule.id, { active: false, lastError: 'The account is inactive or no longer belongs to this organization' });
        return;
      }
      await this.assertReportGrant(user, schedule.orgId, schedule.params['vehicleIds'] as string[], schedule.params['geofenceIds'] as string[] | undefined);
      // Use the actual delivery attempt time, so a schedule created before mail is configured
      // sends the current rolling period when the server is eventually configured.
      const range = periodRange(schedule.period as ScheduledReportPeriod, now, schedule.reportFromTime, schedule.reportToTime);
      const p = schedule.params;
      const result = await this.reports.generate({
        type: schedule.reportType as ReportType,
        vehicleIds: p['vehicleIds'] as string[], from: range.from, to: range.to,
        speedLimit: p['speedLimit'] as number | undefined,
        minSpeedKmh: p['minSpeedKmh'] as number | undefined,
        minStopMin: p['minStopMin'] as number | undefined,
        geofenceIds: p['geofenceIds'] as string[] | undefined,
        organizationId: schedule.orgId ?? undefined,
        groupBy: p['groupBy'] as ReportParams['groupBy'],
      });
      const csv = this.safeCsv(result);
      if (Buffer.byteLength(csv, 'utf8') > 8 * 1024 * 1024) throw new Error('Report exceeds the 8 MB email attachment limit');
      const to = [...new Map([user.email, ...schedule.recipientEmails].map(address => [address.toLowerCase(), address])).values()];
      await this.sendEmail(schedule, to, result, csv, now);
      await this.schedules.update(schedule.id, { lastSentAt: now, lastError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Report delivery failed';
      const revoked = error instanceof ForbiddenException;
      await this.schedules.update(schedule.id, { ...(revoked ? { active: false } : {}), lastError: message.slice(0, 500) });
      this.logger.warn(`Scheduled report ${schedule.id} failed: ${message}`);
    }
  }

  private safeCsv(result: ReportResult): string {
    const rows = result.rows.map(row => row.map(value => {
      if (typeof value !== 'string') return value;
      if (/^\d{14,16}$/.test(value.trim())) return 'Vehicle';
      return /^[=+@\-]/.test(value) ? `'${value}` : value;
    }));
    return this.reports.toCsv({ ...result, rows });
  }

  private async sendEmail(schedule: ScheduledReport, to: string[], result: ReportResult, csv: string, scheduledAt: Date): Promise<void> {
    const apiKey = process.env['RESEND_API_KEY'];
    const from = process.env['REPORT_EMAIL_FROM'];
    if (!apiKey || !from) throw new Error('Email delivery is not configured on the server');
    const date = pktParts(scheduledAt);
    const dayKey = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
    const filename = `${schedule.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'report'}-${dayKey}.csv`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `scheduled-report/${schedule.id}/${dayKey}`,
      },
      body: JSON.stringify({
        from, to, subject: `Trackvee report: ${schedule.title} (${result.from} – ${result.to})`,
        html: `<p>Your scheduled report <strong>${this.escapeHtml(schedule.title)}</strong> is attached as a CSV file.</p><p>Period: ${this.escapeHtml(result.from)} – ${this.escapeHtml(result.to)}<br>Vehicles: ${result.vehicleCount}<br>Rows: ${result.rowCount}</p>`,
        attachments: [{ filename, content: Buffer.from(csv, 'utf8').toString('base64') }],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Email provider rejected the report (HTTP ${response.status})`);
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  }
}
