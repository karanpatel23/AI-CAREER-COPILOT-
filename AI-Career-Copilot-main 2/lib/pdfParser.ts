/**
 * PDF Parser Module
 *
 * Extracts plain text from PDF files using pdf-parse.
 */

type PdfParseResult = {
  text?: string;
};

type PdfParse = (buffer: Buffer) => Promise<PdfParseResult>;

// pdf-parse does not ship strong TypeScript types in this project setup.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as PdfParse;

export async function parsePDF(fileBuffer: Buffer): Promise<string> {
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new Error('PDF buffer is empty');
  }

  const data = await pdfParse(fileBuffer);
  return data.text?.trim() ?? '';
}
