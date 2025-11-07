const { validateFileUpload } = require('../middleware/validation');
const { AppError } = require('../middleware/errorHandler');

describe('validateFileUpload', () => {
  const next = jest.fn();
  const res = {};

  beforeEach(() => {
    next.mockReset();
  });

  test('passes when file is valid', () => {
    const req = {
      file: {
        size: 1024,
        mimetype: 'audio/mpeg',
        path: 'uploads/test.mp3'
      }
    };

    validateFileUpload(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('fails when file is missing', () => {
    const req = {};
    validateFileUpload(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });

  test('fails when file is too large', () => {
    const req = {
      file: {
        size: 999999999,
        mimetype: 'audio/mpeg',
        path: 'uploads/large.mp3'
      }
    };

    // Mock fs.existsSync and unlinkSync to avoid real fs operations
    jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
    jest.spyOn(require('fs'), 'unlinkSync').mockImplementation(() => {});

    validateFileUpload(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(413);
  });

  test('fails when mimetype is invalid', () => {
    const req = {
      file: {
        size: 1024,
        mimetype: 'application/octet-stream',
        path: 'uploads/file.bin'
      }
    };

    jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
    jest.spyOn(require('fs'), 'unlinkSync').mockImplementation(() => {});

    validateFileUpload(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
  });
});
