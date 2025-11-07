const fs = require('fs');
const path = require('path');

class TaskExecutor {
  constructor() {
    this.tasks = new Map();
    this.tools = new Map();
    this.taskQueue = [];
    this.registerDefaultTools();
  }

  /**
   * Register default tools
   */
  registerDefaultTools() {
    // Email tool
    this.registerTool('sendEmail', {
      description: 'Send an email to specified recipient',
      execute: async (params) => {
        console.log(`Sending email to ${params.to}: ${params.subject}`);
        // In production, integrate with email service (SendGrid, Nodemailer, etc.)
        return {
          success: true,
          message: `Email queued to ${params.to}`
        };
      },
      parameters: {
        to: 'string',
        subject: 'string',
        body: 'string'
      }
    });

    // Calendar tool
    this.registerTool('scheduleEvent', {
      description: 'Schedule a calendar event',
      execute: async (params) => {
        console.log(`Scheduling event: ${params.title} at ${params.datetime}`);
        // In production, integrate with Google Calendar, Outlook, etc.
        return {
          success: true,
          message: `Event "${params.title}" scheduled`
        };
      },
      parameters: {
        title: 'string',
        datetime: 'string',
        duration: 'number',
        description: 'string'
      }
    });

    // Reminder tool
    this.registerTool('setReminder', {
      description: 'Set a reminder for a specific time',
      execute: async (params) => {
        console.log(`Setting reminder: ${params.message} at ${params.datetime}`);
        return {
          success: true,
          message: `Reminder set for ${params.datetime}`
        };
      },
      parameters: {
        message: 'string',
        datetime: 'string'
      }
    });

    // File save tool
    this.registerTool('saveTranscript', {
      description: 'Save transcript to a file',
      execute: async (params) => {
        const outputDir = path.join(__dirname, '..', 'transcripts');
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const filename = params.filename || `transcript_${Date.now()}.txt`;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, params.content);
        
        return {
          success: true,
          message: `Transcript saved to ${filepath}`,
          filepath
        };
      },
      parameters: {
        content: 'string',
        filename: 'string'
      }
    });

    // Search tool
    this.registerTool('webSearch', {
      description: 'Perform a web search',
      execute: async (params) => {
        console.log(`Searching for: ${params.query}`);
        // In production, integrate with search API (Google, Bing, etc.)
        return {
          success: true,
          message: `Search results for "${params.query}"`,
          results: []
        };
      },
      parameters: {
        query: 'string'
      }
    });

    // Note taking tool
    this.registerTool('createNote', {
      description: 'Create a note or document',
      execute: async (params) => {
        const notesDir = path.join(__dirname, '..', 'notes');
        if (!fs.existsSync(notesDir)) {
          fs.mkdirSync(notesDir, { recursive: true });
        }
        
        const filename = `${params.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
        const filepath = path.join(notesDir, filename);
        
        fs.writeFileSync(filepath, `# ${params.title}\n\n${params.content}`);
        
        return {
          success: true,
          message: `Note created: ${params.title}`,
          filepath
        };
      },
      parameters: {
        title: 'string',
        content: 'string'
      }
    });
  }

  /**
   * Register a new tool
   */
  registerTool(name, tool) {
    this.tools.set(name, {
      name,
      description: tool.description,
      execute: tool.execute,
      parameters: tool.parameters
    });
  }

  /**
   * Get all available tools
   */
  getAvailableTools() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }));
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName, parameters) {
    const tool = this.tools.get(toolName);
    
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      const result = await tool.execute(parameters);
      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Add a task to the queue
   */
  addTask(task) {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const taskData = {
      id: taskId,
      ...task,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.tasks.set(taskId, taskData);
    this.taskQueue.push(taskId);
    
    return taskId;
  }

  /**
   * Execute a task
   */
  async executeTask(taskId, options = {}) {
    const task = this.tasks.get(taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Update task status
    task.status = 'executing';
    task.updatedAt = new Date();
    this.tasks.set(taskId, task);

    try {
      let result;
      
      if (task.toolName) {
        // Execute a specific tool
        result = await this.executeTool(task.toolName, task.parameters || {});
      } else if (task.action) {
        // Execute a custom action
        result = await this.executeCustomAction(task.action, task.data);
      } else {
        throw new Error('Task has no executable action');
      }

      // Update task status
      task.status = 'completed';
      task.result = result;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);

      return result;
    } catch (error) {
      // Update task status
      task.status = 'failed';
      task.error = error.message;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);

      throw error;
    }
  }

  /**
   * Execute a custom action
   */
  async executeCustomAction(action, data) {
    // Placeholder for custom action execution
    console.log(`Executing custom action: ${action}`, data);
    return {
      success: true,
      message: `Custom action "${action}" executed`
    };
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  /**
   * Get pending tasks
   */
  getPendingTasks() {
    return Array.from(this.tasks.values()).filter(task => task.status === 'pending');
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId, status) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      this.tasks.set(taskId, task);
    }
  }

  /**
   * Delete task
   */
  deleteTask(taskId) {
    this.tasks.delete(taskId);
    const index = this.taskQueue.indexOf(taskId);
    if (index > -1) {
      this.taskQueue.splice(index, 1);
    }
  }

  /**
   * Clear all tasks
   */
  clearAllTasks() {
    this.tasks.clear();
    this.taskQueue = [];
  }
}

module.exports = TaskExecutor;
