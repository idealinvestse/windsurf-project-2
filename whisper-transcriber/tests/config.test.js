describe('Config module', () => {
  it('loads required sections with defaults', () => {
    const config = require('../config');

    expect(config.server).toBeDefined();
    expect(typeof config.server.port).toBe('number');
    expect(config.openai.apiKey).toBeDefined();
    expect(config.uploads.directory).toBeDefined();
    expect(config.audio.chunkSize).toBeGreaterThan(0);
    expect(config.isTest()).toBe(true);
  });
});
