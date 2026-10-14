import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { GlobalPricing } from './entities/global-pricing.entity.js';
import { PricingActivityType } from './entities/pricing-activity-type.entity.js';
import { OrgBillingConfig } from './entities/org-billing-config.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { Payment } from './entities/payment.entity.js';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(GlobalPricing) private globalPricingRepo: Repository<GlobalPricing>,
    @InjectRepository(PricingActivityType) private activityTypeRepo: Repository<PricingActivityType>,
    @InjectRepository(OrgBillingConfig) private orgConfigRepo: Repository<OrgBillingConfig>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    private dataSource: DataSource,
  ) {}

  // ── Global Pricing ─────────────────────────────────────────────────────────

  async getGlobalPricing(): Promise<GlobalPricing> {
    const rows = await this.globalPricingRepo.find();
    if (rows.length === 0) {
      return this.globalPricingRepo.save(this.globalPricingRepo.create());
    }
    return rows[0];
  }

  async updateGlobalPricing(dto: Partial<GlobalPricing>, userId: string): Promise<GlobalPricing> {
    const row = await this.getGlobalPricing();
    Object.assign(row, dto);
    (row as any).updatedBy = { id: userId };
    return this.globalPricingRepo.save(row);
  }

  // ── Activity Types ─────────────────────────────────────────────────────────

  async getActivityTypes(): Promise<PricingActivityType[]> {
    return this.activityTypeRepo.find({ order: { sortOrder: 'ASC', createdAt: 'ASC' } });
  }

  async createActivityType(dto: { name: string; charge: number; sortOrder?: number }): Promise<PricingActivityType> {
    const item = this.activityTypeRepo.create({ ...dto, isBuiltIn: false });
    return this.activityTypeRepo.save(item);
  }

  async updateActivityType(id: string, dto: { name?: string; charge?: number; isActive?: boolean; sortOrder?: number }): Promise<PricingActivityType> {
    const item = await this.activityTypeRepo.findOneBy({ id });
    if (!item) throw new NotFoundException('Activity type not found');
    Object.assign(item, dto);
    return this.activityTypeRepo.save(item);
  }

  async deleteActivityType(id: string): Promise<void> {
    const item = await this.activityTypeRepo.findOneBy({ id });
    if (!item) throw new NotFoundException('Activity type not found');
    if (item.isBuiltIn) throw new BadRequestException('Built-in activity types cannot be deleted');
    await this.activityTypeRepo.remove(item);
  }

  // ── Org Billing Config ─────────────────────────────────────────────────────

  async getOrgConfig(orgId: string): Promise<{ config: OrgBillingConfig | null; effective: GlobalPricing & { billingCycle: string; activityOverrides: Record<string, number> | null } }> {
    const global = await this.getGlobalPricing();
    const config = await this.orgConfigRepo.findOneBy({ orgId });
    const effective = {
      ...global,
      billingCycle: config?.billingCycle ?? 'monthly',
      activityOverrides: config?.activityOverrides ?? null,
      devicePrice: config?.devicePrice ?? global.devicePrice,
      installationCharge: config?.installationCharge ?? global.installationCharge,
      removalCharge: config?.removalCharge ?? global.removalCharge,
      transferCharge: config?.transferCharge ?? global.transferCharge,
      reactivationCharge: config?.reactivationCharge ?? global.reactivationCharge,
      monthlyFixedCharge: config?.monthlyFixedCharge ?? global.monthlyFixedCharge,
      taxPercent: config?.taxPercent ?? global.taxPercent,
      thresholdEnabled: config?.thresholdEnabled ?? global.thresholdEnabled,
      thresholdDays: config?.thresholdDays ?? global.thresholdDays,
    };
    return { config, effective };
  }

  async saveOrgConfig(orgId: string, dto: Partial<OrgBillingConfig>): Promise<OrgBillingConfig> {
    let config = await this.orgConfigRepo.findOneBy({ orgId });
    if (!config) {
      config = this.orgConfigRepo.create({ orgId });
    }
    Object.assign(config, dto);
    return this.orgConfigRepo.save(config);
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  async listInvoices(filters: {
    orgId?: string; deviceId?: string; status?: string;
    from?: string; to?: string; page?: number; limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const qb = this.invoiceRepo.createQueryBuilder('inv')
      .leftJoinAndSelect('inv.org', 'org')
      .orderBy('inv.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.orgId) qb.andWhere('inv.org_id = :orgId', { orgId: filters.orgId });
    if (filters.deviceId) qb.andWhere('inv.device_id = :deviceId', { deviceId: filters.deviceId });
    if (filters.status) qb.andWhere('inv.status = :status', { status: filters.status });
    if (filters.from) qb.andWhere('inv.created_at >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('inv.created_at <= :to', { to: filters.to + 'T23:59:59Z' });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit } as const;
  }

  async createInvoice(dto: {
    orgId: string; deviceId?: string; vehicleId?: string; activityTypeId?: string;
    type: string; periodFrom?: string; periodTo?: string;
    baseAmount: number; taxAmount?: number; status?: string;
    dueDate?: string; description?: string; notes?: string; createdById?: string;
  }): Promise<Invoice> {
    const year = new Date().getFullYear();
    const seq = await this.dataSource.query(`SELECT nextval('invoice_seq') AS n`);
    const invoiceNo = `INV-${year}-${String(seq[0].n).padStart(4, '0')}`;
    const base = Number(dto.baseAmount);
    const tax = Number(dto.taxAmount ?? 0);
    const inv = this.invoiceRepo.create({
      orgId: dto.orgId,
      deviceId: dto.deviceId ?? null,
      vehicleId: dto.vehicleId ?? null,
      activityTypeId: dto.activityTypeId ?? null,
      invoiceNo,
      type: dto.type as Invoice['type'],
      periodFrom: dto.periodFrom ?? null,
      periodTo: dto.periodTo ?? null,
      baseAmount: base,
      taxAmount: tax,
      totalAmount: base + tax,
      status: (dto.status as Invoice['status']) ?? 'draft',
      dueDate: dto.dueDate ?? null,
      description: dto.description ?? null,
      notes: dto.notes ?? null,
      createdBy: dto.createdById ? { id: dto.createdById } as any : null,
    });
    return this.invoiceRepo.save(inv);
  }

  async updateInvoice(id: string, dto: Partial<Invoice>): Promise<Invoice> {
    const inv = await this.invoiceRepo.findOneBy({ id });
    if (!inv) throw new NotFoundException('Invoice not found');
    Object.assign(inv, dto);
    if (dto.baseAmount !== undefined || dto.taxAmount !== undefined) {
      inv.totalAmount = Number(inv.baseAmount) + Number(inv.taxAmount);
    }
    return this.invoiceRepo.save(inv);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  async listPayments(filters: { orgId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const qb = this.paymentRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.org', 'org')
      .orderBy('p.payment_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.orgId) qb.andWhere('p.org_id = :orgId', { orgId: filters.orgId });
    if (filters.from) qb.andWhere('p.payment_date >= :from', { from: filters.from });
    if (filters.to) qb.andWhere('p.payment_date <= :to', { to: filters.to });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async createPayment(dto: {
    orgId: string; paymentDate: string; amount: number;
    method?: string; referenceNo?: string; description?: string; notes?: string; createdById?: string;
  }): Promise<Payment> {
    const year = new Date().getFullYear();
    const seq = await this.dataSource.query(`SELECT nextval('payment_seq') AS n`);
    const paymentNo = `PMT-${year}-${String(seq[0].n).padStart(4, '0')}`;
    const pmt = this.paymentRepo.create({
      ...dto,
      paymentNo,
      method: (dto.method as any) ?? 'cash',
      createdBy: dto.createdById ? { id: dto.createdById } as any : null,
    });
    return this.paymentRepo.save(pmt);
  }

  // ── Statement ──────────────────────────────────────────────────────────────

  async getStatement(orgId: string, from?: string, to?: string, deviceId?: string) {
    const invQb = this.invoiceRepo.createQueryBuilder('inv')
      .leftJoin('inv.org', 'org')
      .select(['inv.id', 'inv.invoice_no', 'inv.type', 'inv.description', 'inv.total_amount',
               'inv.status', 'inv.period_from', 'inv.period_to', 'inv.created_at',
               'inv.device_id', 'inv.vehicle_id'])
      .where('inv.org_id = :orgId', { orgId })
      .andWhere('inv.status != :cancelled', { cancelled: 'cancelled' });

    const pmtQb = this.paymentRepo.createQueryBuilder('p')
      .select(['p.id', 'p.payment_no', 'p.payment_date', 'p.amount', 'p.method', 'p.description'])
      .where('p.org_id = :orgId', { orgId });

    if (from) {
      invQb.andWhere('inv.created_at >= :from', { from });
      pmtQb.andWhere('p.payment_date >= :from', { from });
    }
    if (to) {
      invQb.andWhere('inv.created_at <= :to', { to: to + 'T23:59:59Z' });
      pmtQb.andWhere('p.payment_date <= :to', { to });
    }
    if (deviceId) invQb.andWhere('inv.device_id = :deviceId', { deviceId });

    const [invoices, payments] = await Promise.all([invQb.getRawMany(), pmtQb.getRawMany()]);

    type LedgerEntry = {
      date: string; refNo: string; description: string;
      debit: number; credit: number; type: 'invoice' | 'payment';
      deviceId?: string; vehicleId?: string; status?: string;
    };

    const entries: LedgerEntry[] = [
      ...invoices.map(i => ({
        date: i.inv_created_at,
        refNo: i.inv_invoice_no,
        description: i.inv_description ?? i.inv_type,
        debit: Number(i.inv_total_amount),
        credit: 0,
        type: 'invoice' as const,
        deviceId: i.inv_device_id,
        vehicleId: i.inv_vehicle_id,
        status: i.inv_status,
      })),
      ...payments.map(p => ({
        date: p.p_payment_date,
        refNo: p.p_payment_no,
        description: p.p_description ?? 'Payment received',
        debit: 0,
        credit: Number(p.p_amount),
        type: 'payment' as const,
      })),
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    const ledger = entries.map(e => {
      balance += e.debit - e.credit;
      return { ...e, balance };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    return {
      ledger,
      summary: {
        totalBilled: totalDebit,
        totalPaid: totalCredit,
        outstanding: totalDebit - totalCredit,
        invoiceCount: invoices.length,
        paymentCount: payments.length,
      },
    };
  }
}
