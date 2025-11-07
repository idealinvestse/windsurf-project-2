const express = require('express');
const request = require('supertest');
const transcriptionRoutes = require('../routes/transcription');

describe('Transcription routes', () => {
  test('POST /api/transcribe responds with transcription text', async () => {
    const app = express();

    // Mock controller
    const controller = {
      transcribeFile: jest.fn().mockResolvedValue('mock transcription')
    };

    // Mock upload middleware to inject a valid req.file
    const mockUpload = {
      single: () => (req, res, next) => {
        req.file = {
          originalname: 'sample.mp3',
          size: 1024,
          mimetype: 'audio/mpeg',
          path: 'uploads/sample.mp3'
        };
        next();
      }
    };

    app.use('/api/transcribe', transcriptionRoutes(controller, mockUpload));

    const res = await request(app)
      .post('/api/transcribe')
      .set('Content-Type', 'application/json')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, text: 'mock transcription' });
    expect(controller.transcribeFile).toHaveBeenCalledWith('uploads/sample.mp3');
  });
});
