import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    // Phase 4: Add DatabaseModule, AuthModule, VehiclesModule, DevicesModule, etc.
  ],
})
export class AppModule {}
