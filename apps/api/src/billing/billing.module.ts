import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GlobalPricing } from './entities/global-pricing.entity.js';
import { PricingActivityType } from './entities/pricing-activity-type.entity.js';
import { OrgBillingConfig } from './entities/org-billing-config.entity.js';
import { Invoice } from './entities/invoice.entity.js';
import { Payment } from './entities/payment.entity.js';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalPricing, PricingActivityType, OrgBillingConfig, Invoice, Payment])],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
