// Small fetch wrapper for the Laravel API.
//
// - Relative URLs go through the Vite proxy, so the browser stays on one origin
//   and the Sanctum session cookie is first-party.
// - Laravel's SPA flow needs a CSRF cookie (XSRF-TOKEN) echoed back in the
//   X-XSRF-TOKEN header on every state-changing request; fetch does not do that
//   for us (unlike axios), so it is handled here.
export class ApiError extends Error {
  readonly status: number
  /** Laravel validation errors (422): field name -> messages. */
  readonly errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

type ApiInit = Omit<RequestInit, 'body'> & { json?: unknown }

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

let unauthorizedHandler: (() => void) | null = null

/** Lets the auth provider react to an expired session (any 401 response). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

async function ensureCsrfCookie(force = false) {
  if (!force && readCookie('XSRF-TOKEN')) return
  await fetch('/sanctum/csrf-cookie', { credentials: 'include' })
}

async function send(path: string, init: ApiInit): Promise<Response> {
  const { json, headers, ...rest } = init
  const method = (rest.method ?? 'GET').toUpperCase()

  const requestHeaders: Record<string, string> = { Accept: 'application/json' }
  if (json !== undefined) requestHeaders['Content-Type'] = 'application/json'
  if (!SAFE_METHODS.has(method)) {
    const token = readCookie('XSRF-TOKEN')
    if (token) requestHeaders['X-XSRF-TOKEN'] = token
  }

  return fetch(`/api${path}`, {
    credentials: 'include',
    ...rest,
    method,
    headers: { ...requestHeaders, ...(headers as Record<string, string> | undefined) },
    body: json === undefined ? undefined : JSON.stringify(json),
  })
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const unsafe = !SAFE_METHODS.has((init.method ?? 'GET').toUpperCase())
  if (unsafe) await ensureCsrfCookie()

  let response = await send(path, init)

  // 419 = CSRF token mismatch (e.g. the session was rotated): refresh once and retry.
  if (response.status === 419 && unsafe) {
    await ensureCsrfCookie(true)
    response = await send(path, init)
  }

  if (response.status === 401) unauthorizedHandler?.()

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string
      errors?: Record<string, string[]>
    } | null
    throw new ApiError(response.status, body?.message ?? response.statusText, body?.errors)
  }

  // 204 No Content (e.g. logout) has no body to parse.
  if (response.status === 204) return undefined as T

  return response.json() as Promise<T>
}
