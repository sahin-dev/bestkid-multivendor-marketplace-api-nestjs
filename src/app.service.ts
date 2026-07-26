import { Injectable } from '@nestjs/common';
import { PrismaService } from './modules/prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getHealth() {
    const startedAt = Date.now();
    const checks = {
      api: {
        status: 'ok',
      },
      database: await this.checkDatabase(),
    };

    const isHealthy = Object.values(checks).every(
      (check) => check.status === 'ok',
    );

    return {
      status: isHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV ?? 'development',
      response_time_ms: Date.now() - startedAt,
      checks,
    };
  }

  private async checkDatabase() {
    const startedAt = Date.now();

    try {
      await this.prismaService.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        response_time_ms: Date.now() - startedAt,
      };
    } catch {
      return {
        status: 'error',
        message: 'Database health check failed',
        response_time_ms: Date.now() - startedAt,
      };
    }
  }
}
