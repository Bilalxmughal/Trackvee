import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const dbUrl = config.get<string>('DATABASE_URL')!;

        // Ensure global_display_id_seq exists before TypeORM synchronize runs
        const client = new Client({ connectionString: dbUrl });
        await client.connect();
        await client.query(
          `CREATE SEQUENCE IF NOT EXISTS global_display_id_seq START WITH 1001 INCREMENT BY 1`,
        );
        await client.end();

        return {
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: config.get('NODE_ENV') !== 'production',
          logging: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
