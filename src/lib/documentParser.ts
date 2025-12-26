import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ParsedDocument {
  text: string;
  pages?: number;
  wordCount: number;
  chunks: string[];
}

// Chunk size for RAG (approx 500 tokens)
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + CHUNK_SIZE;
    
    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start + CHUNK_SIZE / 2) {
        end = breakPoint + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
  }
  
  return chunks.filter(chunk => chunk.length > 50);
}

export async function parsePDF(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n\n';
  }
  
  const text = fullText.trim();
  const wordCount = text.split(/\s+/).length;
  
  return {
    text,
    pages: pdf.numPages,
    wordCount,
    chunks: chunkText(text),
  };
}

export async function parseDOCX(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value.trim();
  const wordCount = text.split(/\s+/).length;
  
  return {
    text,
    wordCount,
    chunks: chunkText(text),
  };
}

export async function parseTXT(file: File): Promise<ParsedDocument> {
  const text = await file.text();
  const wordCount = text.split(/\s+/).length;
  
  return {
    text: text.trim(),
    wordCount,
    chunks: chunkText(text),
  };
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      return parsePDF(file);
    case 'docx':
      return parseDOCX(file);
    case 'txt':
    case 'md':
      return parseTXT(file);
    case 'epub':
      // EPUB is essentially a ZIP with HTML files, simplified handling
      return parseTXT(file);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

// Token estimation (rough approximation)
export function estimateTokens(text: string): number {
  // Average 4 characters per token for English
  return Math.ceil(text.length / 4);
}
