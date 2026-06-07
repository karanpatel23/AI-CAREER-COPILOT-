import type { NextApiRequest, NextApiResponse } from 'next';
import { LIMITS, normalizeWhitespace } from '../text';

export class ApiError extends Error {
  statusCode: number;
  code?: string;
  details?: unknown;
  action?: string;

  constructor(statusCode: number, message: string, code?: string, details?: unknown, action?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.action = action;
  }
}

export function assertMethod(req: NextApiRequest, allowedMethods: string[]): void {
  if (!req.method || !allowedMethods.includes(req.method)) {
    throw new ApiError(
      405,
      `Method not allowed. Use ${allowedMethods.join(', ')}.`,
      'METHOD_NOT_ALLOWED',
      { allowedMethods },
      `Send this request with ${allowedMethods.join(' or ')}.`
    );
  }
}

function bodyRecord(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object.', 'INVALID_BODY');
  }

  return body as Record<string, unknown>;
}

export function getRequiredString(body: unknown, field: string, maxChars?: number): string {
  const value = bodyRecord(body)[field];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, `${field} is required.`, 'VALIDATION_ERROR', { field });
  }

  const cleaned = normalizeWhitespace(value);

  if (maxChars && cleaned.length > maxChars) {
    throw new ApiError(
      413,
      `${field} is too long. Maximum allowed length is ${maxChars} characters.`,
      'FIELD_TOO_LONG',
      { field, maxChars, receivedChars: cleaned.length }
    );
  }

  return cleaned;
}

export function getOptionalString(body: unknown, field: string, maxChars?: number): string | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;

  const value = (body as Record<string, unknown>)[field];

  if (value === undefined || value === null || value === '') return undefined;

  if (typeof value !== 'string') {
    throw new ApiError(400, `${field} must be a string.`, 'VALIDATION_ERROR', { field });
  }

  const cleaned = normalizeWhitespace(value);

  if (maxChars && cleaned.length > maxChars) {
    throw new ApiError(
      413,
      `${field} is too long. Maximum allowed length is ${maxChars} characters.`,
      'FIELD_TOO_LONG',
      { field, maxChars, receivedChars: cleaned.length }
    );
  }

  return cleaned;
}

export function getRequiredUuid(body: unknown, field: string): string {
  const value = getRequiredString(body, field);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new ApiError(400, `${field} must be a valid UUID.`, 'VALIDATION_ERROR', { field });
  }

  return value;
}

export function getEnum<T extends readonly string[]>(
  body: unknown,
  field: string,
  allowedValues: T,
  defaultValue?: T[number]
): T[number] {
  const value = getOptionalString(body, field) ?? defaultValue;

  if (!value || !allowedValues.includes(value as T[number])) {
    throw new ApiError(
      400,
      `${field} must be one of: ${allowedValues.join(', ')}.`,
      'VALIDATION_ERROR',
      { field, allowedValues }
    );
  }

  return value as T[number];
}

export function validateMeaningfulLength(value: string, field: string, minChars = LIMITS.minMeaningfulTextChars): void {
  if (value.trim().length < minChars) {
    throw new ApiError(
      422,
      `${field} must contain at least ${minChars} meaningful characters.`,
      'TEXT_TOO_SHORT',
      { field, minChars },
      `Provide a fuller ${field.replace(/_/g, ' ')} with enough detail to analyze.`
    );
  }
}

export function handleApiError(
  res: NextApiResponse,
  error: unknown,
  fallbackMessage = 'Internal server error'
): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
      ...(error.action ? { action: error.action } : {}),
    });
    return;
  }

  const message = error instanceof Error ? error.message : fallbackMessage;

  res.status(500).json({
    success: false,
    error: fallbackMessage,
    code: 'INTERNAL_SERVER_ERROR',
    details: message,
    action: 'Check server logs and verify environment variables, database schema, and AI provider configuration.',
  });
}
