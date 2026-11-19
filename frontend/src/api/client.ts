// Minimal fetch wrapper. All requests use relative URLs so they go through the
// Vite proxy (same origin). `credentials: 'include'` keeps the session cookie
// flowing once authentication is added.
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...init.headers },
  })

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText)
  }

  return response.json() as Promise<T>
}
