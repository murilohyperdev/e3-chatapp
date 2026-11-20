// Guided, paced demonstration of the exercise's item 8: two independent sessions
// (administrator and regular user) walk through every required scenario.
//
//   cd e2e && npm run demo                    # two visible windows side by side
//   DEMO_HEADLESS=1 DEMO_RECORD=1 npm run demo   # no windows, one video per session
//
// Normally started through ./scripts/demo.sh. Environment variables:
//   DEMO_HEADLESS=1  no visible windows        DEMO_RECORD=1  save e2e/recordings/{admin,user}.webm
//   DEMO_SLOW=2      pauses twice as long      E2E_CHROMIUM_PATH  use an installed Chromium
import { chromium, expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { ADMIN, BASE_URL, RUN_ID, USER, apiCall, clearMailbox, endActiveAlert, signIn, waitForResetLink } from '../support/helpers.ts'

const HEADLESS = process.env.DEMO_HEADLESS === '1'
const RECORD = process.env.DEMO_RECORD === '1'
const SLOW = Number(process.env.DEMO_SLOW ?? '1')
const WIDTH = 760
const HEIGHT = 820
const RECORDINGS = new URL('../recordings/', import.meta.url).pathname

// A dedicated seeded account for the password step, so the two demo accounts always keep working.
const RESET_ACCOUNT = { email: 'margaret@example.com', original: 'password', changed: 'a-brand-new-secret-1' }

interface Session {
  name: 'admin' | 'user'
  browser: Browser
  context: BrowserContext
  page: Page
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms * SLOW))

// ---- on-screen captions (injected overlay, no change to the application) ----

const CAPTION_SCRIPT = `
  const draw = () => {
    const text = sessionStorage.getItem('demo-caption')
    let bar = document.getElementById('demo-caption')
    if (!text) { bar?.remove(); return }
    if (!bar) {
      bar = document.createElement('div')
      bar.id = 'demo-caption'
      bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:10px 16px;' +
        'background:#111c;color:#fff;font:600 15px system-ui;text-align:center;pointer-events:none'
      document.body.appendChild(bar)
    }
    bar.textContent = text
  }
  document.addEventListener('DOMContentLoaded', draw)
  window.addEventListener('demo-caption', draw)
`

async function caption(session: Session, text: string) {
  await session.page.evaluate((value) => {
    sessionStorage.setItem('demo-caption', value)
    window.dispatchEvent(new Event('demo-caption'))
  }, `${session.name === 'admin' ? 'ADMINISTRATOR' : 'USER'} · ${text}`)
}

/** Shows the same step title on both windows, then waits so the audience can read it. */
async function step(sessions: Session[], text: string, holdMs = 1500) {
  console.log(`\n▶ ${text}`)
  await Promise.all(sessions.map((session) => caption(session, text)))
  await pause(holdMs)
}

// ---- sessions ----

async function openSession(name: 'admin' | 'user', account: { email: string; password: string }, slot: number): Promise<Session> {
  const browser = await chromium.launch({
    headless: HEADLESS,
    executablePath: process.env.E2E_CHROMIUM_PATH || undefined,
    args: HEADLESS ? [] : [`--window-position=${slot * (WIDTH + 20)},0`, `--window-size=${WIDTH},${HEIGHT + 90}`],
  })
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    baseURL: BASE_URL,
    recordVideo: RECORD ? { dir: `${RECORDINGS}${name}`, size: { width: WIDTH, height: HEIGHT } } : undefined,
  })
  await context.addInitScript(CAPTION_SCRIPT)
  const page = await context.newPage()
  const session: Session = { name, browser, context, page }
  await caption(session, 'starting').catch(() => undefined)
  await signIn(page, account.email, account.password)
  return session
}

async function closeSession(session: Session) {
  await session.context.setOffline(false).catch(() => undefined)
  const video = session.page.video()
  await session.context.close()
  if (RECORD && video) await video.saveAs(`${RECORDINGS}${session.name}.webm`)
  await session.browser.close()
}

const modal = (session: Session) => session.page.getByRole('dialog', { name: 'Alert: where are you?' })
const typeSlowly = (page: Page, label: string, text: string) =>
  page.getByRole('textbox', { name: label }).pressSequentially(text, { delay: 40 * SLOW })

// ---- password recovery (needs the one-reset-per-minute throttle to be respected) ----

async function requestResetLink(page: Page): Promise<string> {
  await clearMailbox(RESET_ACCOUNT.email)
  const deadline = Date.now() + 90_000
  for (;;) {
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill(RESET_ACCOUNT.email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    const sent = page.getByText(/emailed your password reset link/i)
    if (await sent.waitFor({ timeout: 5_000 }).then(() => true, () => false)) break
    if (Date.now() > deadline) throw new Error('The reset email request stayed throttled')
    await pause(5_000)
  }
  return waitForResetLink(RESET_ACCOUNT.email)
}

async function chooseNewPassword(page: Page, link: string, password: string) {
  await page.goto(link)
  await page.getByLabel(/^New password/).fill(password)
  await page.getByLabel('Confirm new password').fill(password)
  await page.getByRole('button', { name: 'Reset password' }).click()
}

/** Puts the demo account back to its documented password, whatever state a failed run left it in. */
async function restorePassword() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.E2E_CHROMIUM_PATH || undefined })
  try {
    const page = await (await browser.newContext({ baseURL: BASE_URL })).newPage()
    const stillOriginal = await page.request
      .post(`${BASE_URL}/api/login`, { data: { email: RESET_ACCOUNT.email, password: RESET_ACCOUNT.original }, failOnStatusCode: false })
      .then((r) => r.ok(), () => false)
    if (stillOriginal) return
    await chooseNewPassword(page, await requestResetLink(page), RESET_ACCOUNT.original)
    await expect(page).toHaveURL(/\/login/)
  } finally {
    await browser.close()
  }
}

// ---- the demonstration ----

async function main() {
  if (RECORD) mkdirSync(RECORDINGS, { recursive: true })
  const admin = await openSession('admin', ADMIN, 0)
  const user = await openSession('user', USER, 1)
  const both = [admin, user]
  let passwordTouched = false

  try {
    await endActiveAlert(admin.context.request) // a known starting point on a shared dev stack
    await Promise.all(both.map((s) => s.page.reload()))

    await step(both, 'Two independent sessions: separate cookies, separate WebSocket connections', 2500)

    // 1. Chat
    await step(both, '1/7 Chat: a message reaches the other session without a refresh')
    const fromAdmin = `${RUN_ID} Hello from the administrator`
    await typeSlowly(admin.page, 'Message', fromAdmin)
    await admin.page.getByRole('button', { name: 'Send' }).click()
    await expect(user.page.getByText(fromAdmin)).toBeVisible()
    await pause(1500)
    const fromUser = `${RUN_ID} Hi, the user here`
    await typeSlowly(user.page, 'Message', fromUser)
    await user.page.keyboard.press('Enter')
    await expect(admin.page.getByText(fromUser)).toBeVisible()
    await pause(2000)

    // 2. Permission enforcement (before any alert, so the missing buttons are obvious)
    await step(both, '2/7 Permissions: only the administrator can start or end alerts')
    await expect(admin.page.getByRole('button', { name: 'Start alert' })).toBeVisible()
    await expect(user.page.getByRole('button', { name: 'Start alert' })).toHaveCount(0)
    await pause(1500)
    const refused = await apiCall(user.context.request, 'POST', '/alerts')
    expect(refused.status()).toBe(403)
    await caption(user, `Calling POST /api/alerts directly as the user → ${refused.status()} Forbidden`)
    await pause(3000)

    // 3. Alert delivery
    await step(both, '3/7 Alert delivery: the administrator starts an alert, the user is asked live')
    await admin.page.getByRole('button', { name: 'Start alert' }).click()
    await expect(modal(user)).toBeVisible()
    await expect(modal(admin)).toBeVisible()
    await pause(2500)

    // 4. Location updates
    await step(both, '4/7 Location updates: each pick appears on both 2x2 boards immediately')
    await user.page.getByRole('button', { name: 'Square B' }).click()
    await expect(admin.page.getByTestId('square-b').getByText(USER.name, { exact: true })).toBeVisible()
    await pause(2000)
    await admin.page.getByRole('button', { name: 'Square A' }).click()
    await expect(user.page.getByTestId('square-a').getByText(ADMIN.name, { exact: true })).toBeVisible()
    await pause(2500)

    // 5. Refresh and reconnection recovery
    await step(both, '5/7 Recovery: refresh keeps the pick; an alert ended while offline appears on reconnect')
    await user.page.reload()
    await expect(user.page.getByTestId('square-b').getByText(`${USER.name} (you)`)).toBeVisible()
    await expect(modal(user)).toHaveCount(0)
    await pause(2000)
    await caption(user, 'Network cut for this session…')
    await user.context.setOffline(true)
    await pause(1500)
    await caption(admin, 'Ending the alert while the user is offline…')
    await admin.page.getByRole('button', { name: 'End alert' }).click()
    await expect(admin.page.getByText('This alert has ended. Locations are closed.')).toBeVisible()
    await pause(2500)
    await caption(user, 'Network is back…')
    await user.context.setOffline(false)
    await expect(user.page.getByText('This alert has ended. Locations are closed.')).toBeVisible({ timeout: 30_000 })
    await pause(2500)

    // 6. Ending alerts (and a fresh alert starts clean)
    await step(both, '6/7 Ending alerts: locations are closed; a new alert starts with no responses')
    await admin.page.getByRole('button', { name: 'Start alert' }).click()
    await expect(modal(user)).toBeVisible()
    for (const key of ['a', 'b', 'c', 'd']) {
      await expect(admin.page.getByTestId(`square-${key}`).locator('.MuiChip-root')).toHaveCount(0)
    }
    await pause(2000)
    await endActiveAlert(admin.context.request)
    await expect(user.page.getByText('This alert has ended. Locations are closed.')).toBeVisible()
    await pause(2500)

    // 7. Password recovery, in the user's window (it signs out first). Last, because of the reset throttle.
    await step(both, '7/7 Password recovery: emailed one-use link (waits for the 1/min limit if needed)', 2500)
    await user.page.getByRole('button', { name: 'Sign out' }).click()
    passwordTouched = true
    await caption(user, `Forgot password for ${RESET_ACCOUNT.email}: the email arrives in Mailpit`)
    const link = await requestResetLink(user.page)
    await caption(user, 'Opening the link from the email and choosing a new password')
    await pause(2000)
    await chooseNewPassword(user.page, link, RESET_ACCOUNT.changed)
    await expect(user.page).toHaveURL(/\/login/)
    await caption(user, 'Signing in with the new password')
    await signIn(user.page, RESET_ACCOUNT.email, RESET_ACCOUNT.changed)
    await pause(2500)
    await caption(user, 'Done. The demo account is restored to its documented password next.')
    await pause(2000)
    console.log('\n✔ Demo finished')
  } finally {
    await endActiveAlert(admin.context.request).catch(() => undefined)
    await Promise.all(both.map(closeSession))
    if (passwordTouched) {
      console.log('Restoring the demo account password…')
      await restorePassword()
    }
    if (RECORD) console.log(`Recordings: ${RECORDINGS}admin.webm and ${RECORDINGS}user.webm`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
