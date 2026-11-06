import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AirlinesService } from './airlines.service.js';

@ApiTags('airlines')
@Controller('airlines')
export class AirlinesPublicController {
  constructor(private readonly svc: AirlinesService) {}

  @Post('vehicles/login')
  vehicleLogin(@Body() body: { plateNumber: string; pin: string }) {
    return this.svc.vehicleLogin(body.plateNumber, body.pin);
  }

  @Get('crews/lookup-uid')
  lookupCrewByPartialUid(@Query('digits') digits: string) {
    return this.svc.lookupCrewByPartialUid(digits);
  }
}
