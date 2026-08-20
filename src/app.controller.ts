import { Controller, Get, HttpStatus, Render, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators';

@Controller()
@ApiTags('System')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Render('index')
  @Public()
  @ApiOperation({ summary: 'Render the API landing page' })
  getHello(): Record<string, any> {
    return { message: 'Hello World' };
  }

  @Get('/health')
  @Public()
  @ApiOperation({
    summary: 'Health check for uptime monitors and deployment verification',
  })
  @ApiResponse({
    status: 200,
    description: 'Application and required dependencies are healthy',
  })
  @ApiResponse({
    status: 503,
    description:
      'Application is reachable but one or more required dependencies are unhealthy',
  })
  async getHealth(@Res({ passthrough: true }) response: Response) {
    const health = await this.appService.getHealth();

    if (health.status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return health;
  }

  @Get('/debug-sentry')
  @Public()
  getError() {
    throw new Error('My first Sentry error!');
  }
}
