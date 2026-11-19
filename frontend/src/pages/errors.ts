import { ApiError } from '../api/client'

/** First validation message for a field, if the server returned one. */
export function fieldError(error: unknown, field: string): string | undefined {
  return error instanceof ApiError ? error.errors[field]?.[0] : undefined
}

/** Message to show for a failure that is not tied to a specific field. */
export function generalError(error: unknown, fields: string[]): string | undefined {
  if (!error) return undefined
  if (error instanceof ApiError && fields.some((field) => error.errors[field])) return undefined
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}
