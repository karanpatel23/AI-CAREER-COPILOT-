import { ApiError } from './http';

export const DEMO_USER_UUID = '00000000-0000-0000-0000-000000000000';

const DATABASE_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUPABASE_AUTH_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDatabaseUuid(value: string): boolean {
  return DATABASE_UUID_REGEX.test(value);
}

export function isSupabaseAuthUuid(value: string): boolean {
  return SUPABASE_AUTH_UUID_REGEX.test(value);
}

export function isDemoUserUuid(value: string): boolean {
  return value.toLowerCase() === DEMO_USER_UUID;
}

export function allowDemoUserUuid(): boolean {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_USER_ID === 'true';
}

export function assertUploadUserId(value: string): void {
  if (!isDatabaseUuid(value)) {
    throw new ApiError(400, 'user_id must be a UUID in 8-4-4-4-12 format.', 'VALIDATION_ERROR', { field: 'user_id' });
  }

  if (isDemoUserUuid(value)) {
    if (!allowDemoUserUuid()) {
      throw new ApiError(
        400,
        'The all-zero demo UUID is disabled in production.',
        'DEMO_USER_ID_DISABLED',
        { field: 'user_id' },
        'Use the real Supabase Auth user ID from auth.users.id, or set ALLOW_DEMO_USER_ID=true only for a controlled demo environment.'
      );
    }

    return;
  }

  if (!isSupabaseAuthUuid(value)) {
    throw new ApiError(
      400,
      'user_id must be a valid Supabase Auth UUID, or the local demo UUID during development.',
      'VALIDATION_ERROR',
      { field: 'user_id' },
      'Use a real Supabase Auth user ID from auth.users.id. For local testing only, you may use 00000000-0000-0000-0000-000000000000.'
    );
  }
}
