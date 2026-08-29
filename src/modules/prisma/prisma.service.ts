import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from 'generated/prisma/client';
import dbConfigObj, { dbConfig } from '../../config/db.config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(
    @Inject(dbConfigObj.KEY)
    private readonly dbConfiguration: ConfigType<typeof dbConfig>,
  ) {
    const pool = new Pool({
      connectionString: dbConfiguration.connectionString,
      host: dbConfiguration.connectionString ? undefined : dbConfiguration.host,
      port: dbConfiguration.connectionString ? undefined : dbConfiguration.port,
      user: dbConfiguration.connectionString ? undefined : dbConfiguration.user,
      password: dbConfiguration.connectionString
        ? undefined
        : dbConfiguration.password,
      database: dbConfiguration.connectionString
        ? undefined
        : dbConfiguration.database,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    const adapter = new PrismaPg(pool, { disposeExternalPool: true });
    super({ adapter });

    this.logger.log('Prisma database pool initialized.');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
