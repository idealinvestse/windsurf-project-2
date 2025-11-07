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

  const mockSocket = {
    emit: jest.fn()
  };
  
  const mockIo = {
    to: jest.fn().mockReturnValue(mockSocket)
  };

  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock socket but keep implementation
    mockSocket.emit.mockClear();
    // Re-setup the mock implementation after clearing
    mockIo.to.mockReturnValue(mockSocket);
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
    
    // Mock fs.createReadStream to avoid real file operations
    jest.spyOn(fs, 'createReadStream').mockReturnValue({
      pipe: jest.fn()
    });

    // Ensure the mock is properly set up
    mockOpenAI.audio.transcriptions.create.mockResolvedValue({ text: 'hello world' });

    const text = await controller.transcribeFile('uploads/sample.mp3');

    expect(text).toBe('hello world');
    expect(fs.existsSync).toHaveBeenCalledWith('uploads/sample.mp3');
    expect(unlinkSpy).toHaveBeenCalledWith('uploads/sample.mp3');
  });

  test('transcribeAndAnalyze emits events and cleans up', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    
    // Mock fs.createReadStream to avoid real file operations
    jest.spyOn(fs, 'createReadStream').mockReturnValue({
      pipe: jest.fn()
    });

    // Ensure the mock is properly set up
    mockOpenAI.audio.transcriptions.create.mockResolvedValue({ text: 'hello world' });

    // Mock analyzer to avoid errors
    mockAnalyzer.analyzeTranscript.mockResolvedValue({ 
      summary: 'ok', 
      actionItems: [],
      topics: [],
      entities: { people: [], places: [], organizations: [] },
      questions: [],
      sentiment: 'neutral',
      suggestedTools: []
    });
    mockAnalyzer.shouldCallTool.mockResolvedValue({ shouldCall: false, tools: [] });

    const text = await controller.transcribeAndAnalyze('uploads/chunk.mp3', 'session-1');

    expect(text).toBe('hello world');
    // Check if io.to was called
    expect(mockIo.to).toHaveBeenCalledWith('session-1');
    // emitted transcription
    expect(mockSocket.emit).toHaveBeenCalledWith('transcription', expect.objectContaining({
      text: 'hello world',
      isFinal: true
    }));
    // analyzer used
    expect(mockAnalyzer.analyzeTranscript).toHaveBeenCalledWith('hello world', 'session-1');
    // cleanup
    expect(unlinkSpy).toHaveBeenCalledWith('uploads/chunk.mp3');
  });
});
