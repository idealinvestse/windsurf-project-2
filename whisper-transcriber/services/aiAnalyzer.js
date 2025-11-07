const { OpenAI } = require('openai');

class AIAnalyzer {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.conversationHistory = new Map();
  }

  /**
   * Analyze transcribed text and extract insights
   */
  async analyzeTranscript(text, sessionId, options = {}) {
    const history = this.conversationHistory.get(sessionId) || [];
    
    // Add the new text to history
    history.push({
      role: 'user',
      content: text
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are an intelligent assistant analyzing conversation transcripts in real-time.
Your tasks are to:
1. Identify key topics and themes
2. Detect action items, tasks, and deadlines
3. Extract important entities (people, places, organizations)
4. Identify questions that need answers
5. Detect sentiment and emotion
6. Suggest relevant tools or actions based on the conversation

Provide your analysis in JSON format with the following structure:
{
  "summary": "Brief summary of the conversation",
  "topics": ["topic1", "topic2"],
  "actionItems": [{"task": "description", "priority": "high|medium|low", "deadline": "if mentioned"}],
  "entities": {"people": [], "places": [], "organizations": []},
  "questions": ["question1", "question2"],
  "sentiment": "positive|neutral|negative",
  "suggestedTools": [{"tool": "toolName", "reason": "why this tool is suggested"}]
}`
          },
          ...history
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      
      // Update history with assistant response
      history.push({
        role: 'assistant',
        content: response.choices[0].message.content
      });
      
      // Keep only last 10 messages to avoid token limits
      if (history.length > 10) {
        this.conversationHistory.set(sessionId, history.slice(-10));
      } else {
        this.conversationHistory.set(sessionId, history);
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing transcript:', error);
      throw error;
    }
  }

  /**
   * Detect and classify tasks from transcription
   */
  async detectTasks(text) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a task detection system. Analyze the text and extract all actionable tasks.
For each task, provide:
- description: Clear description of the task
- priority: high, medium, or low
- category: meeting, research, coding, writing, communication, etc.
- estimatedTime: rough estimate in minutes
- dependencies: any mentioned prerequisites

Return as JSON array of tasks.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error detecting tasks:', error);
      throw error;
    }
  }

  /**
   * Determine if a tool should be called based on conversation
   */
  async shouldCallTool(text, availableTools) {
    try {
      const toolDescriptions = availableTools.map(t => 
        `${t.name}: ${t.description}`
      ).join('\n');

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: `You are a tool selection assistant. Based on the user's speech, determine if any tools should be called.
Available tools:
${toolDescriptions}

Respond with JSON:
{
  "shouldCall": true/false,
  "tools": [
    {
      "name": "toolName",
      "parameters": {},
      "reason": "why this tool should be called"
    }
  ]
}`
          },
          {
            role: 'user',
            content: text
          }
        ],
        response_format: { type: "json_object" }
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      console.error('Error determining tool call:', error);
      throw error;
    }
  }

  /**
   * Generate a response based on the conversation context
   */
  async generateResponse(text, sessionId) {
    const history = this.conversationHistory.get(sessionId) || [];
    
    history.push({
      role: 'user',
      content: text
    });

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant engaged in a conversation. Provide relevant, concise responses.'
          },
          ...history
        ],
        temperature: 0.8
      });

      const assistantMessage = response.choices[0].message.content;
      
      history.push({
        role: 'assistant',
        content: assistantMessage
      });

      if (history.length > 10) {
        this.conversationHistory.set(sessionId, history.slice(-10));
      } else {
        this.conversationHistory.set(sessionId, history);
      }

      return assistantMessage;
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history for a session
   */
  clearHistory(sessionId) {
    this.conversationHistory.delete(sessionId);
  }

  /**
   * Get conversation history for a session
   */
  getHistory(sessionId) {
    return this.conversationHistory.get(sessionId) || [];
  }
}

module.exports = AIAnalyzer;
