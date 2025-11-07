const logger = require('../utils/logger');

describe('Logger', () => {
  test('should support different log levels without throwing', () => {
    expect(() => logger.debug('debug message')).not.toThrow();
    expect(() => logger.info('info message')).not.toThrow();
    expect(() => logger.warn('warn message')).not.toThrow();
    expect(() => logger.error('error message')).not.toThrow();
  });

  test('child logger adds context', () => {
    const child = logger.child({ service: 'test' });
    expect(() => child.info('message', { action: 'run' })).not.toThrow();
  });
});
