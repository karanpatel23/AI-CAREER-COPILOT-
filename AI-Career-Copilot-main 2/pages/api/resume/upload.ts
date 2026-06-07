/**
 * POST /api/resume/upload
 * Handles PDF resume upload, text extraction, validation, and storage.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import type { File, Fields, Files, Part } from 'formidable';
import fs from 'fs';
import path from 'path';
import { ApiError, assertMethod, handleApiError } from '../../../lib/api/http';
import { parsePDF } from '../../../lib/pdfParser';
import { hasMeaningfulText, normalizeWhitespace } from '../../../lib/text';
import { supabaseAdmin } from '../../../lib/supabaseClient';
import { assertUploadUserId } from '../../../lib/api/uuid';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
function firstFieldValue(fields: Fields, key: string): string | null {
  const value = fields[key];
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' && first.trim() ? first.trim() : null;
}

function firstFile(files: Files, key: string): File | null {
  const uploadedFile = files[key];
  if (!uploadedFile) return null;
  return Array.isArray(uploadedFile) ? uploadedFile[0] ?? null : uploadedFile;
}

function parseMultipartForm(req: NextApiRequest): Promise<{ fields: Fields; files: Files }> {
  const form = formidable({
    keepExtensions: true,
    maxFileSize: MAX_FILE_SIZE_BYTES,
    multiples: false,
    filter: (part: Part) => {
      if (part.name !== 'file') return true;
      return part.mimetype === 'application/pdf';
    },
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (err: Error | null, fields: Fields, files: Files) => {
      if (err) {
        reject(new ApiError(400, err.message, 'UPLOAD_PARSE_ERROR'));
        return;
      }

      resolve({ fields, files });
    });
  });
}

async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // The OS or formidable may already have cleaned up the temp file.
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let tempFilePath: string | null = null;

  try {
    assertMethod(req, ['POST']);
    const { fields, files } = await parseMultipartForm(req);
    const file = firstFile(files, 'file');

    if (!file) {
      throw new ApiError(400, 'A PDF file is required in the file field.', 'FILE_REQUIRED');
    }

    tempFilePath = file.filepath;

    const extension = path.extname(file.originalFilename || '').toLowerCase();
    if (file.mimetype !== 'application/pdf' && extension !== '.pdf') {
      throw new ApiError(400, 'Only PDF files are allowed.', 'INVALID_FILE_TYPE');
    }

    if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_BYTES) {
      throw new ApiError(413, 'PDF must be 5MB or smaller.', 'FILE_TOO_LARGE');
    }

    const userId = firstFieldValue(fields, 'user_id');
    if (!userId) {
      throw new ApiError(400, 'user_id is required.', 'USER_ID_REQUIRED');
    }

    assertUploadUserId(userId);

    const buffer = await fs.promises.readFile(file.filepath);
    const text = normalizeWhitespace(await parsePDF(buffer));

    if (!hasMeaningfulText(text)) {
      throw new ApiError(
        422,
        'Could not extract meaningful text from PDF.',
        'PDF_TEXT_EXTRACTION_FAILED',
        undefined,
        'Upload a text-based PDF instead of a scanned image-only resume.'
      );
    }

    const { data, error } = await supabaseAdmin
      .from('resumes')
      .insert({
        user_id: userId,
        raw_text: text,
      })
      .select()
      .single();

    if (error) {
      throw new ApiError(500, 'Failed to save resume.', 'DATABASE_ERROR', error.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully.',
      resume: data,
      textStats: {
        characters: text.length,
        words: text.split(/\s+/).filter(Boolean).length,
      },
    });
  } catch (error) {
    return handleApiError(res, error, 'Resume upload failed');
  } finally {
    if (tempFilePath) {
      await cleanupTempFile(tempFilePath);
    }
  }
}
