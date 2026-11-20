import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test'

export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025'
export const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

export const ADMIN = { email: 'admin@example.com', password: 'password', name: 'Ada Admin' }
export const USER = { email: 'user@example.com', password: 'password', name: 'Demo User' }

// Tag everything this run writes to the chat so it is easy to recognise in the dev database.
export const RUN_ID = `e2e-${Date.now().toString(36)}`

export interface Session {
  context: BrowserContext
  page: Page
}

/** An independent browser session (own cookies, own WebSocket) signed in through the real form. */
export async function openSession(browser: Browser, account: { email: string; password: string }): Promise<Session> {
  const context = await browser.newContext()
  const page = await context.newPage()
  await signIn(page, account.email, account.password)
  return { context, page }
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

/** Same-origin API call with the session cookie and the CSRF header, like the React client does. */
export async function apiCall(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown,
) {
  const cookies = (await request.storageState()).cookies
  const xsrf = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')
  // Sanctum only treats a request as a SPA (session) request when it comes from the frontend origin.
  const headers: Record<string, string> = { Accept: 'application/json', Origin: BASE_URL, Referer: `${BASE_URL}/` }
  if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf.value)
  return request.fetch(`${BASE_URL}/api${path}`, { method, data, headers })
}

/** Makes sure the request context holds a CSRF cookie. */
export async function primeCsrf(request: APIRequestContext) {
  await request.get(`${BASE_URL}/sanctum/csrf-cookie`)
}

/** Ends any alert that is still active, so a scenario can start its own. Uses the admin session. */
export async function endActiveAlert(request: APIRequestContext) {
  const current = await apiCall(request, 'GET', '/alerts/current')
  const body = (await current.json()) as { data: { id: number; status: string } | null }
  if (body.data && body.data.status === 'active') {
    await apiCall(request, 'POST', `/alerts/${body.data.id}/end`)
  }
}

// ---- Mailpit (local email inbox) ----

/** Deletes only the emails addressed to `recipient`, so other mail in the inbox is left alone. */
export async function clearMailbox(recipient: string) {
  await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`, { method: 'DELETE' })
}

/** Waits for an email to `recipient` and returns the first link that points at the reset page. */
export async function waitForResetLink(recipient: string): Promise<string> {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const list = (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${recipient}`)}`)).json()) as {
      messages: { ID: string }[]
    }
    if (list.messages.length > 0) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`)).json()) as {
        Text: string
        HTML: string
      }
      const match = `${message.Text}\n${message.HTML}`.match(/https?:\/\/[^\s"'<>]*reset-password[^\s"'<>]*/)
      if (match) return match[0].replace(/&amp;/g, '&')
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`No reset email for ${recipient} arrived in Mailpit`)
}
