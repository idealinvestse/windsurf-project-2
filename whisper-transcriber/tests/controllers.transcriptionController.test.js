const fs = require('fs');
const TranscriptionController = require('../controllers/transcriptionController');

describe('TranscriptionController', () => {
  const mockOpenAI = {
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({ text: 'hello world' })
      }
    }
  };

  const mockAnalyzer = {
    analyzeTranscript: jest.fn().mockResolvedValue({ summary: 'ok', actionItems: [] }),
    shouldCallTool: jest.fn().mockResolvedValue({ shouldCall: false, tools: [] })
  };

  const mockTaskExecutor = {
    getAvailableTools: jest.fn().mockReturnValue([]),
    addTask: jest.fn()
  };

  const mockIo = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn()
  };

  let controller;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new TranscriptionController(
      mockOpenAI,
      mockAnalyzer,
      mockTaskExecutor,
      mockIo
    );
  });

  test('transcribeFile returns text and cleans up file', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    const text = await controller.transcribeFile('uploads/sample.mp3');

    expect(text).toBe('hello world');
    expect(fs.existsSync).toHaveBeenCalledWith('uploads/sample.mp3');
    expect(unlinkSpy).toHaveBeenCalledWith('uploads/sample.mp3');
  });

  test('transcribeAndAnalyze emits events and cleans up', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});

    const text = await controller.transcribeAndAnalyze('uploads/chunk.mp3', 'session-1');

    expect(text).toBe('hello world');
    // emitted transcription
    expect(mockIo.to).toHaveBeenCalledWith('session-1');
    expect(mockIo.emit).toHaveBeenCalledWith('transcription', expect.objectContaining({
      text: 'hello world',
      isFinal: true
    }));
    // analyzer used
    expect(mockAnalyzer.analyzeTranscript).toHaveBeenCalledWith('hello world', 'session-1');
    // cleanup
    expect(unlinkSpy).toHaveBeenCalledWith('uploads/chunk.mp3');
  });
});
