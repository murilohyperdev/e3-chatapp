import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, setUnauthorizedHandler } from './client'

const fetchMock = vi.fn()

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), { status })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

afterEach(() => {
  fetchMock.mockReset()
  setUnauthorizedHandler(null)
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('sends JSON and the CSRF header on unsafe requests', async () => {
    document.cookie = 'XSRF-TOKEN=abc%3D123'
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    await api('/login', { method: 'POST', json: { email: 'a@b.c' } })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/login')
    expect(init.headers['X-XSRF-TOKEN']).toBe('abc=123')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.c' }))
  })

  it('fetches the CSRF cookie first when it is missing', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))

    await api('/login', { method: 'POST', json: {} })

    expect(fetchMock.mock.calls[0][0]).toBe('/sanctum/csrf-cookie')
    expect(fetchMock.mock.calls[1][0]).toBe('/api/login')
  })

  it('does not send a CSRF header on GET requests', async () => {
    document.cookie = 'XSRF-TOKEN=abc'
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}))

    await api('/user')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1].headers['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('returns undefined for 204 responses', async () => {
    document.cookie = 'XSRF-TOKEN=abc'
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(api('/logout', { method: 'POST' })).resolves.toBeUndefined()
  })

  it('exposes validation errors on ApiError', async () => {
    document.cookie = 'XSRF-TOKEN=abc'
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { message: 'Invalid', errors: { email: ['Wrong credentials'] } }),
    )

    const error = await api('/login', { method: 'POST', json: {} }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(422)
    expect((error as ApiError).errors.email).toEqual(['Wrong credentials'])
  })

  it('retries once after a 419 CSRF mismatch', async () => {
    document.cookie = 'XSRF-TOKEN=old'
    fetchMock.mockResolvedValueOnce(jsonResponse(419, { message: 'CSRF token mismatch.' }))
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    await expect(api('/login', { method: 'POST', json: {} })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('notifies the unauthorized handler on 401', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { message: 'Unauthenticated.' }))

    await expect(api('/user')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledOnce()
  })
})
