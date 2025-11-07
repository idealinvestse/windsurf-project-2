const { AppError, errorHandler } = require('../middleware/errorHandler');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  test('formats AppError correctly', () => {
    const err = new AppError('Not found', 404);
    const req = { method: 'GET', path: '/x' };
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ message: 'Not found', statusCode: 404 })
      })
    );
  });

  test('wraps non-AppError and hides stack in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Boom');
    const req = { method: 'GET', path: '/x' };
    const res = mockRes();
    const next = jest.fn();

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(false);
    expect(payload.error.message).toBe('Boom');
    expect(payload.error.stack).toBeUndefined();

    process.env.NODE_ENV = prev;
  });
});
