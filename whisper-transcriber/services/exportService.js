const fs = require('fs');
const path = require('path');

class ExportService {
  constructor() {
    this.outputDir = path.join(__dirname, '..', 'exports');
    this.ensureOutputDir();
  }

  /**
   * Ensure output directory exists
   */
  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Export to plain text
   */
  exportToText(transcript, options = {}) {
    const filename = options.filename || `transcript_${Date.now()}.txt`;
    const filepath = path.join(this.outputDir, filename);
    
    let content = '';
    
    if (options.includeMetadata) {
      content += `Transcript\n`;
      content += `Generated: ${new Date().toLocaleString()}\n`;
      content += `Duration: ${options.duration || 'N/A'}\n`;
      content += `\n${'='.repeat(50)}\n\n`;
    }
    
    if (Array.isArray(transcript)) {
      transcript.forEach((item, index) => {
        if (item.timestamp) {
          content += `[${item.timestamp}] ${item.text}\n\n`;
        } else {
          content += `${item.text}\n\n`;
        }
      });
    } else {
      content += transcript;
    }
    
    fs.writeFileSync(filepath, content);
    
    return {
      success: true,
      filepath,
      filename
    };
  }

  /**
   * Export to JSON
   */
  exportToJSON(transcript, metadata = {}) {
    const filename = metadata.filename || `transcript_${Date.now()}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    const data = {
      metadata: {
        generatedAt: new Date().toISOString(),
        ...metadata
      },
      transcript: Array.isArray(transcript) ? transcript : [{ text: transcript }]
    };
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    return {
      success: true,
      filepath,
      filename
    };
  }

  /**
   * Export to Markdown
   */
  exportToMarkdown(transcript, options = {}) {
    const filename = options.filename || `transcript_${Date.now()}.md`;
    const filepath = path.join(this.outputDir, filename);
    
    let content = '';
    
    // Add header
    content += `# Transcript\n\n`;
    
    if (options.includeMetadata) {
      content += `**Generated:** ${new Date().toLocaleString()}\n\n`;
      if (options.duration) {
        content += `**Duration:** ${options.duration}\n\n`;
      }
    }
    
    content += `---\n\n`;
    
    // Add transcript content
    if (Array.isArray(transcript)) {
      transcript.forEach((item, index) => {
        if (item.timestamp) {
          content += `### ${item.timestamp}\n\n`;
        }
        content += `${item.text}\n\n`;
      });
    } else {
      content += `${transcript}\n\n`;
    }
    
    // Add analysis if provided
    if (options.analysis) {
      content += `---\n\n## Analysis\n\n`;
      content += `${options.analysis}\n\n`;
    }
    
    fs.writeFileSync(filepath, content);
    
    return {
      success: true,
      filepath,
      filename
    };
  }

  /**
   * Export to SRT (subtitle format)
   */
  exportToSRT(transcript) {
    const filename = `transcript_${Date.now()}.srt`;
    const filepath = path.join(this.outputDir, filename);
    
    let content = '';
    
    if (Array.isArray(transcript)) {
      transcript.forEach((item, index) => {
        if (item.start && item.end) {
          content += `${index + 1}\n`;
          content += `${this.formatSRTTime(item.start)} --> ${this.formatSRTTime(item.end)}\n`;
          content += `${item.text}\n\n`;
        }
      });
    }
    
    fs.writeFileSync(filepath, content);
    
    return {
      success: true,
      filepath,
      filename
    };
  }

  /**
   * Format time for SRT (HH:MM:SS,mmm)
   */
  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  }

  /**
   * Export to VTT (WebVTT format)
   */
  exportToVTT(transcript) {
    const filename = `transcript_${Date.now()}.vtt`;
    const filepath = path.join(this.outputDir, filename);
    
    let content = 'WEBVTT\n\n';
    
    if (Array.isArray(transcript)) {
      transcript.forEach((item, index) => {
        if (item.start && item.end) {
          content += `${index + 1}\n`;
          content += `${this.formatVTTTime(item.start)} --> ${this.formatVTTTime(item.end)}\n`;
          content += `${item.text}\n\n`;
        }
      });
    }
    
    fs.writeFileSync(filepath, content);
    
    return {
      success: true,
      filepath,
      filename
    };
  }

  /**
   * Format time for VTT (HH:MM:SS.mmm)
   */
  formatVTTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  /**
   * Export with analysis and tasks
   */
  exportComplete(data) {
    const filename = `complete_transcript_${Date.now()}.json`;
    const filepath = path.join(this.outputDir, filename);
    
    const exportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        ...data.metadata
      },
      transcript: data.transcript,
      analysis: data.analysis || {},
      tasks: data.tasks || [],
      toolExecutions: data.toolExecutions || []
    };
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    return {
      success: true,
      filepath,
      filename
    };
  }

  /**
   * Get all exported files
   */
  listExports() {
    const files = fs.readdirSync(this.outputDir);
    
    return files.map(filename => {
      const filepath = path.join(this.outputDir, filename);
      const stats = fs.statSync(filepath);
      
      return {
        filename,
        filepath,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    });
  }

  /**
   * Delete an export file
   */
  deleteExport(filename) {
    const filepath = path.join(this.outputDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return { success: true };
    }
    
    return { success: false, error: 'File not found' };
  }
}

module.exports = ExportService;
