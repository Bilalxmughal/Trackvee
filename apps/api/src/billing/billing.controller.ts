import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // ── Global Pricing ─────────────────────────────────────────────────────────

  @Get('pricing')
  @Roles('super_admin', 'admin', 'ops')
  getGlobalPricing() {
    return this.billingService.getGlobalPricing();
  }

  @Put('pricing')
  @Roles('super_admin', 'admin')
  updateGlobalPricing(@Body() dto: any, @Request() req: any) {
    return this.billingService.updateGlobalPricing(dto, req.user.id);
  }

  // ── Activity Types ─────────────────────────────────────────────────────────

  @Get('pricing/activities')
  @Roles('super_admin', 'admin', 'ops')
  getActivityTypes() {
    return this.billingService.getActivityTypes();
  }

  @Post('pricing/activities')
  @Roles('super_admin', 'admin')
  createActivityType(@Body() dto: { name: string; charge: number; sortOrder?: number }) {
    return this.billingService.createActivityType(dto);
  }

  @Patch('pricing/activities/:id')
  @Roles('super_admin', 'admin')
  updateActivityType(@Param('id') id: string, @Body() dto: any) {
    return this.billingService.updateActivityType(id, dto);
  }

  @Delete('pricing/activities/:id')
  @Roles('super_admin', 'admin')
  deleteActivityType(@Param('id') id: string) {
    return this.billingService.deleteActivityType(id);
  }

  // ── Org Billing Config ─────────────────────────────────────────────────────

  @Get('config/:orgId')
  @Roles('super_admin', 'admin', 'ops')
  getOrgConfig(@Param('orgId') orgId: string) {
    return this.billingService.getOrgConfig(orgId);
  }

  @Put('config/:orgId')
  @Roles('super_admin', 'admin')
  saveOrgConfig(@Param('orgId') orgId: string, @Body() dto: any) {
    return this.billingService.saveOrgConfig(orgId, dto);
  }

  // ── Invoices ───────────────────────────────────────────────────────────────

  @Get('invoices')
  @Roles('super_admin', 'admin', 'ops')
  listInvoices(@Query() q: any) {
    return this.billingService.listInvoices({
      orgId: q.orgId, deviceId: q.deviceId, status: q.status,
      from: q.from, to: q.to,
      page: q.page ? +q.page : 1,
      limit: q.limit ? +q.limit : 50,
    });
  }

  @Post('invoices')
  @Roles('super_admin', 'admin', 'ops')
  createInvoice(@Body() dto: any, @Request() req: any) {
    return this.billingService.createInvoice({ ...dto, createdById: req.user.id });
  }

  @Patch('invoices/:id')
  @Roles('super_admin', 'admin')
  updateInvoice(@Param('id') id: string, @Body() dto: any) {
    return this.billingService.updateInvoice(id, dto);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  @Get('payments')
  @Roles('super_admin', 'admin', 'ops')
  listPayments(@Query() q: any) {
    return this.billingService.listPayments({
      orgId: q.orgId, from: q.from, to: q.to,
      page: q.page ? +q.page : 1,
      limit: q.limit ? +q.limit : 50,
    });
  }

  @Post('payments')
  @Roles('super_admin', 'admin', 'ops')
  createPayment(@Body() dto: any, @Request() req: any) {
    return this.billingService.createPayment({ ...dto, createdById: req.user.id });
  }

  // ── Statement ──────────────────────────────────────────────────────────────

  @Get('statement/:orgId')
  @Roles('super_admin', 'admin', 'ops')
  getStatement(
    @Param('orgId') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.billingService.getStatement(orgId, from, to, deviceId);
  }
}
