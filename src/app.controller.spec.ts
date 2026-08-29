import { Test, TestingModule } from '@nestjs/testing';

jest.mock('./app.service', () => ({
  AppService: class MockAppService {},
}));

import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const appService = {
    getHealth: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toEqual({ message: 'Hello World' });
    });
  });

  describe('health', () => {
    it('returns health payload without changing status when healthy', async () => {
      const health = { status: 'ok', checks: { api: { status: 'ok' } } };
      const response = { status: jest.fn() } as any;
      appService.getHealth.mockResolvedValue(health);

      await expect(appController.getHealth(response)).resolves.toBe(health);
      expect(response.status).not.toHaveBeenCalled();
    });

    it('sets 503 when health is degraded', async () => {
      const health = {
        status: 'degraded',
        checks: { database: { status: 'error' } },
      };
      const response = { status: jest.fn() } as any;
      appService.getHealth.mockResolvedValue(health);

      await expect(appController.getHealth(response)).resolves.toBe(health);
      expect(response.status).toHaveBeenCalledWith(503);
    });
  });
});
