/**
 * Comprehensive response formatting utilities for AI model responses
 * Handles JSON arrays, objects, bullet lists, and various text formats
 */

// Recursively convert a JSON value to a Markdown bullet-list representation
export const jsonToMarkdown = (value: unknown, depth = 0): string => {
  const indent = '  '.repeat(depth);

  if (Array.isArray(value)) {
    return value
      .map((item) => `${indent}- ${jsonToMarkdown(item, depth + 1).trim()}`)
      .join('\n');
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    
    // Common response wrapper keys that should be unwrapped for natural language flow
    const responseWrapperKeys = [
      'answer', 'response', 'result', 'text', 'content', 'message', 
      'explanation', 'summary', 'description', 'output', 'reply', 'data',
      'value', 'body', 'info', 'details', 'main', 'primary'
    ];
    
    // If it's a single-key object, try to unwrap it more aggressively
    if (entries.length === 1) {
      const [key, val] = entries[0];
      if (typeof val === 'string' || typeof val === 'number') {
        // Check if this looks like a response wrapper key
        if (responseWrapperKeys.includes(key.toLowerCase())) {
          return `${indent}${val}`;
        }
        // Also unwrap if the key looks like a generic field name (snake_case or camelCase)
        if (key.match(/^[a-z][a-z0-9_]*$/i) && key.length < 20) {
          return `${indent}${val}`;
        }
        // For other single-key objects, still show the key but without bold formatting
        return `${indent}${key}: ${val}`;
      }
    }
    
    // For multi-key objects, be more selective about formatting
    return entries
      .map(([key, val]) => {
        if (typeof val === 'object') {
          // Don't bold wrapper-style keys
          if (responseWrapperKeys.includes(key.toLowerCase())) {
            return `${indent}${jsonToMarkdown(val, depth)}`;
          }
          // For other nested objects, use minimal formatting
          return `${indent}${key}:\n${jsonToMarkdown(val, depth + 1)}`;
        }
        
        // For simple key-value pairs, avoid bold formatting for natural flow
        if (responseWrapperKeys.includes(key.toLowerCase())) {
          return `${indent}${val}`;
        }
        
        // Check if this looks like structured data that should be formatted as a list
        if (key.match(/^[a-z][a-z0-9_]*$/i) && key.length < 20) {
          return `${indent}- ${val}`;
        }
        
        // For other cases, use minimal formatting
        return `${indent}${key}: ${val}`;
      })
      .join('\n');
  }

  // Primitive value
  return `${indent}${String(value)}`;
};

// Helper to prettify raw model text into nicer Markdown
export const formatResponseText = (raw: string): string => {
  if (!raw) return raw;

  let text = raw.trim();

  // Remove stray 'null' or 'undefined' tokens sometimes prepended by models
  text = text.replace(/^(?:null|undefined)\s*/i, '');

  // Attempt to parse as JSON and convert to Markdown if possible
  try {
    const json = JSON.parse(text);
    text = jsonToMarkdown(json);
    // Properly unescape JSON strings (convert literal \n to actual newlines, etc.)
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  } catch {
    // Not valid JSON, continue with other formatting tweaks
  }

  /* ---------------------------------------------------------
   *  NEW: Detect "pseudo-list" prose (Gemini style)
   *  If the text contains multiple blank-line-separated blocks and every
   *  block itself contains at least one newline, we interpret it as
   *  an implicit list. Convert each block to a markdown bullet with
   *  sub-bullets for subsequent lines.
   * ---------------------------------------------------------*/
  const blocks = text.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  const isPseudoList = blocks.length > 1 && blocks.every(b => /\n/.test(b));
  if (isPseudoList) {
    const mdBlocks = blocks.map(block => {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return '';
      const [title, ...rest] = lines;
      const sub = rest.map(l => `  - ${l}`).join('\n');
      return rest.length ? `- **${title}**\n${sub}` : `- **${title}**`;
    });
    text = mdBlocks.join('\n');
  }

  // Handle structured data patterns like "method: title\ndetails: content"
  text = text.replace(/^(\s*)(method|technology|tip|step|item):\s*(.+)\n(\s*)details:\s*(.+)/gmi, (match, indent, label, title, detailIndent, details) => {
    return `${indent}- ${title}: ${details}`;
  });

  // Handle other structured key-value patterns - avoid bold formatting for natural flow
  text = text.replace(/^(\s*)([A-Za-z0-9_\s]+):\s*\n(\s*)(.+)/gm, (match, indent, key, contentIndent, content) => {
    // Only convert if it looks like a structured data pattern (not a regular sentence)
    if (key.match(/^[A-Za-z0-9_\s]+$/) && key.length < 30) {
      // Check if this looks like a response wrapper that should be unwrapped
      const responseWrapperKeys = [
        'answer', 'response', 'result', 'text', 'content', 'message', 
        'explanation', 'summary', 'description', 'output', 'reply', 'data',
        'value', 'body', 'info', 'details', 'main', 'primary'
      ];
      if (responseWrapperKeys.some(wrapper => key.toLowerCase().includes(wrapper))) {
        return `${contentIndent}${content}`;
      }
      // For other structured patterns, use minimal formatting
      return `${indent}${key}:\n${contentIndent}${content}`;
    }
    return match;
  });

  // Strip leading key labels like "company_name: " or "summary: " at beginning of a line
  text = text.replace(/^(?:[A-Za-z0-9_]+):\s*(.*)$/gm, (match, val: string) => {
    // Only strip if the key looks like a common JSON field name (no spaces except underscores)
    const key = match.split(':')[0].trim();
    if (key.match(/^[A-Za-z0-9_]+$/)) {
      return val.trim();
    }
    return match; // Keep original if it doesn't look like a JSON field
  });

  // Normalize bullet points while avoiding double conversion
  // Only convert non-dash bullet characters to markdown dashes
  text = text.replace(/^(\s*)([•●◦‣⁃*+])(\s+)(.+)/gm, (match, indent: string, bullet: string, space: string, content: string) => {
    // Skip if it's already a markdown dash (check the whole line pattern)
    if (match.trim().startsWith('- ')) {
      return match;
    }
    return `${indent}- ${content}`;
  });

  // Ensure numbered lists have a space after the dot and preserve content
  text = text.replace(/^(\s*)(\d+)\.\s*(.+)/gm, (_, indent: string, num: string, content: string) => {
    return `${indent}${num}. ${content}`;
  });

  // Improved line break handling for proper markdown lists
  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n/g, '\n\n'); // Normalize paragraph breaks
  text = text.replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines
  
  // Ensure proper spacing around lists for markdown parsing
  // Add blank line before lists only if not already present
  text = text.replace(/\n(?!\n)(?=\s*-\s)/g, '\n\n'); // Space before unordered lists
  text = text.replace(/\n(?!\n)(?=\s*\d+\.\s)/g, '\n\n'); // Space before ordered lists
  
  // Ensure list items are properly formatted for markdown
  text = text.replace(/^(\s*)-\s+/gm, '$1- '); // Normalize bullet spacing
  text = text.replace(/^(\s*)(\d+)\.\s+/gm, '$1$2. '); // Normalize number spacing

  // Ensure blank line after lines that end with ':' so markdown lists start correctly
  text = text.replace(/:\s*\n/g, ':\n\n');

  // Collapse any accidental double bullets ("- - ") into a single bullet
  text = text.replace(/^(\s*)-\s*-\s+/gm, '$1- ');

  // Collapse accidental double numbering ("1. 1.") into single numbering
  text = text.replace(/^(\s*)(\d+)\.\s*\d+\.\s+/gm, '$1$2. ');

  /* ---------------------------------------------------------
   *  HTML → Markdown normalisation
   *  Some model answers come wrapped in simple HTML (e.g. <ul><li> ... ).
   *  Convert a safe subset of tags to Markdown so the subsequent
   *  bullet/number handling produces clean output without double bullets.
   * ---------------------------------------------------------*/
  const htmlTagPattern = /<\/?(?:ul|ol|li|p|br|b|strong|i|em)[^>]*>/i;
  if (htmlTagPattern.test(text)) {
    text = text
      // Line breaks
      .replace(/<br\s*\/?>(?![^]*<br)/gi, '\n')
      // Paragraphs
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      // Bold / strong
      .replace(/<\/?(?:b|strong)[^>]*>/gi, '**')
      // Italic / emphasis
      .replace(/<\/?(?:i|em)[^>]*>/gi, '*')
      // Unordered / ordered list wrappers simply become newlines so list items follow
      .replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n')
      // List items – convert to markdown dash. We add trailing space only once; later cleanup will normalise.
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/li>/gi, '\n');
  }

  return text;
};

// Utility to detect if text contains JSON
export const isJsonString = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};

// Utility to clean up brand tags from text
export const stripBrandTags = (text: string): string => {
  if (!text) return '';
  return text.replace(/<\/?brand>/g, '');
};

// Utility to detect common response patterns
export const detectResponseFormat = (text: string): 'json' | 'markdown' | 'plain' => {
  const trimmed = text.trim();
  
  // Check for JSON
  if (isJsonString(trimmed)) {
    return 'json';
  }
  
  // Check for markdown patterns
  if (trimmed.includes('**') || trimmed.includes('- ') || trimmed.match(/^\d+\./m)) {
    return 'markdown';
  }
  
  return 'plain';
}; 