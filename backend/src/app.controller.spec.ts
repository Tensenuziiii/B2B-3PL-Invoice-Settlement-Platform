import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(() => {
    appController = new AppController();
  });

  describe('root', () => {
    it('should return API metadata and health status', () => {
      expect(appController.root()).toEqual({
        name: 'VECTO Logistics API',
        version: '1.0',
      });
      const health = appController.health();
      expect(health.status).toBe('ok');
      expect(typeof health.timestamp).toBe('string');
      expect(typeof health.uptime).toBe('number');
    });
  });
});
