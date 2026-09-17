import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './users/entities/user.entity.js';
import { Organization } from './organizations/entities/organization.entity.js';
import { Vehicle } from './vehicles/entities/vehicle.entity.js';
import { Device } from './devices/entities/device.entity.js';
import { Telemetry } from './telemetry/entities/telemetry.entity.js';

// Load .env from monorepo root (../../ from apps/api/, ../../../ from dist/)
config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../.env') });

async function seed() {
  const dbUrl = process.env['DATABASE_URL'];
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url: dbUrl,
    entities: [User, Organization, Vehicle, Device, Telemetry],
    synchronize: false,
  });

  await ds.initialize();

  // Ensure global sequence exists
  await ds.query(`CREATE SEQUENCE IF NOT EXISTS global_display_id_seq START WITH 1001 INCREMENT BY 1`);

  const userRepo = ds.getRepository(User);

  const existing = await userRepo.findOne({ where: { email: 'bilalxmughal@gmail.com' } });
  if (existing) {
    console.log(`Super admin already exists — displayId: ${existing.displayId}`);
    await ds.destroy();
    return;
  }

  const password = await bcrypt.hash('Yutrack@361', 12);
  const user = userRepo.create({
    email: 'bilalxmughal@gmail.com',
    password,
    firstName: 'Bilal',
    lastName: 'Mughal',
    role: 'super_admin',
    isActive: true,
  });

  const saved = await userRepo.save(user);
  console.log(`Super admin created!`);
  console.log(`  Email    : ${saved.email}`);
  console.log(`  DisplayID: ${saved.displayId}`);
  console.log(`  UUID     : ${saved.id}`);

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
