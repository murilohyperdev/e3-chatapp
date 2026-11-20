import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { fieldError, generalError } from './errors'

const validation = new ApiError(422, 'The email field is required.', { email: ['The email field is required.'] })

describe('fieldError', () => {
  it('returns the first message for the field', () => {
    expect(fieldError(new ApiError(422, 'x', { email: ['first', 'second'] }), 'email')).toBe('first')
  })

  it('returns nothing for another field, a plain Error or no error', () => {
    expect(fieldError(validation, 'password')).toBeUndefined()
    expect(fieldError(new Error('boom'), 'email')).toBeUndefined()
    expect(fieldError(null, 'email')).toBeUndefined()
  })
})

describe('generalError', () => {
  it('is empty when there is no error', () => {
    expect(generalError(null, ['email'])).toBeUndefined()
  })

  it('is empty when the error belongs to a field that is shown inline', () => {
    expect(generalError(validation, ['email'])).toBeUndefined()
  })

  it('uses the server message for an error not tied to a shown field', () => {
    expect(generalError(new ApiError(429, 'Too many attempts.', {}), ['email'])).toBe('Too many attempts.')
  })

  it('uses a generic message for an unexpected failure', () => {
    expect(generalError(new TypeError('network'), ['email'])).toBe('Something went wrong. Please try again.')
  })
})
