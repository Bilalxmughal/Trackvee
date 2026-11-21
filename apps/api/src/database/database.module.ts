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

        // Ensure global_display_id_seq exists before opening the TypeORM connection
        const client = new Client({ connectionString: dbUrl });
        await client.connect();
        await client.query(
          `CREATE SEQUENCE IF NOT EXISTS global_display_id_seq START WITH 1001 INCREMENT BY 1`,
        );
        // Extract user from connection string and grant sequence access
        try {
          const url = new URL(dbUrl);
          const dbUser = url.username;
          if (dbUser) {
            await client.query(
              `GRANT USAGE, SELECT ON SEQUENCE global_display_id_seq TO "${dbUser}"`,
            );
          }
        } catch { /* ignore if already granted or superuser */ }
        await client.end();

        return {
          type: 'postgres',
          url: dbUrl,
          autoLoadEntities: true,
          synchronize: false,
          logging: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
