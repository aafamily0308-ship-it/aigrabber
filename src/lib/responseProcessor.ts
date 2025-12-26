// Response Processor - Parse AI responses, extract code blocks, handle structured output
// Phase 2: Intelligent Core

export interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedResponse {
  text: string;
  codeBlocks: CodeBlock[];
  hasCode: boolean;
  hasLinks: boolean;
  hasList: boolean;
  hasTable: boolean;
  thinking?: string;
  summary?: string;
}

// Extract code blocks from markdown
export function extractCodeBlocks(text: string): CodeBlock[] {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const blocks: CodeBlock[] = [];
  
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return blocks;
}

// Extract inline code
export function extractInlineCode(text: string): string[] {
  const inlineCodeRegex = /`([^`]+)`/g;
  const codes: string[] = [];
  
  let match;
  while ((match = inlineCodeRegex.exec(text)) !== null) {
    // Skip if it's part of a code block
    if (!text.slice(Math.max(0, match.index - 3), match.index).includes('``')) {
      codes.push(match[1]);
    }
  }

  return codes;
}

// Extract links from markdown
export function extractLinks(text: string): { text: string; url: string }[] {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: { text: string; url: string }[] = [];
  
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    links.push({
      text: match[1],
      url: match[2],
    });
  }

  return links;
}

// Extract lists (bullet and numbered)
export function extractLists(text: string): { type: 'bullet' | 'numbered'; items: string[] }[] {
  const lines = text.split('\n');
  const lists: { type: 'bullet' | 'numbered'; items: string[] }[] = [];
  
  let currentList: { type: 'bullet' | 'numbered'; items: string[] } | null = null;
  
  for (const line of lines) {
    const bulletMatch = line.match(/^[\s]*[-*•]\s+(.+)$/);
    const numberedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/);
    
    if (bulletMatch) {
      if (!currentList || currentList.type !== 'bullet') {
        if (currentList) lists.push(currentList);
        currentList = { type: 'bullet', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (!currentList || currentList.type !== 'numbered') {
        if (currentList) lists.push(currentList);
        currentList = { type: 'numbered', items: [] };
      }
      currentList.items.push(numberedMatch[1]);
    } else if (line.trim() === '' && currentList) {
      lists.push(currentList);
      currentList = null;
    }
  }
  
  if (currentList) lists.push(currentList);
  
  return lists;
}

// Detect if response contains a table
export function hasTable(text: string): boolean {
  // Markdown table pattern: | col1 | col2 |
  const tableRowRegex = /^\|.+\|$/m;
  const tableSeparatorRegex = /^\|[-:| ]+\|$/m;
  
  return tableRowRegex.test(text) && tableSeparatorRegex.test(text);
}

// Extract thinking/reasoning section (common in Claude responses)
export function extractThinking(text: string): { thinking: string | null; mainContent: string } {
  // Look for <thinking> tags or "Let me think..." patterns
  const thinkingTagRegex = /<thinking>([\s\S]*?)<\/thinking>/i;
  const thinkingPhraseRegex = /^(Let me think|Thinking|I'll think|Размышляю|Думаю)[.:]?\s*([\s\S]*?)(?=\n\n|$)/im;
  
  let thinking: string | null = null;
  let mainContent = text;
  
  const tagMatch = text.match(thinkingTagRegex);
  if (tagMatch) {
    thinking = tagMatch[1].trim();
    mainContent = text.replace(thinkingTagRegex, '').trim();
  } else {
    const phraseMatch = text.match(thinkingPhraseRegex);
    if (phraseMatch) {
      thinking = phraseMatch[0].trim();
      mainContent = text.replace(thinkingPhraseRegex, '').trim();
    }
  }
  
  return { thinking, mainContent };
}

// Generate a brief summary of the response
export function generateSummary(text: string, maxLength: number = 100): string {
  // Remove code blocks for summary
  const textWithoutCode = text.replace(/```[\s\S]*?```/g, '[code]');
  
  // Get first paragraph or sentence
  const firstParagraph = textWithoutCode.split('\n\n')[0];
  const firstSentence = firstParagraph.split(/[.!?]/)[0];
  
  let summary = firstSentence.length < maxLength ? firstSentence : 
    firstSentence.slice(0, maxLength - 3) + '...';
  
  return summary.trim();
}

// Parse full response
export function parseResponse(text: string): ParsedResponse {
  const codeBlocks = extractCodeBlocks(text);
  const links = extractLinks(text);
  const lists = extractLists(text);
  const { thinking, mainContent } = extractThinking(text);
  
  return {
    text: mainContent,
    codeBlocks,
    hasCode: codeBlocks.length > 0,
    hasLinks: links.length > 0,
    hasList: lists.length > 0,
    hasTable: hasTable(text),
    thinking: thinking || undefined,
    summary: generateSummary(mainContent),
  };
}

// Format code block for display
export function formatCodeBlock(block: CodeBlock): string {
  return `\`\`\`${block.language}\n${block.code}\n\`\`\``;
}

// Clean response text (remove artifacts, normalize whitespace)
export function cleanResponse(text: string): string {
  return text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
    .replace(/^\s+|\s+$/g, '')        // Trim
    .replace(/\t/g, '  ');            // Tabs to spaces
}

// Detect response language
export function detectLanguage(text: string): 'en' | 'ru' | 'mixed' | 'other' {
  const russianChars = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  const totalChars = russianChars + englishChars;
  
  if (totalChars === 0) return 'other';
  
  const russianRatio = russianChars / totalChars;
  const englishRatio = englishChars / totalChars;
  
  if (russianRatio > 0.7) return 'ru';
  if (englishRatio > 0.7) return 'en';
  if (russianRatio > 0.2 && englishRatio > 0.2) return 'mixed';
  
  return 'other';
}

// Estimate reading time
export function estimateReadingTime(text: string): number {
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}
