import { expect, test, type Browser, type Page } from '@playwright/test'
import { clearMailbox, signIn, waitForResetLink } from '../support/helpers'

// A dedicated seeded account, so the demo administrator and user keep working whatever happens.
const ACCOUNT = { email: 'margaret@example.com', original: 'password', changed: 'a-brand-new-secret-1' }

// Laravel allows one reset email per address per minute, so a second request has to wait for it.
test.setTimeout(240_000)

/** Asks for a reset link, retrying while the server says "too many requests", and returns the emailed link. */
async function requestResetLink(page: Page): Promise<string> {
  await clearMailbox(ACCOUNT.email)
  const deadline = Date.now() + 90_000
  for (;;) {
    await page.goto('/forgot-password')
    await page.getByLabel('Email').fill(ACCOUNT.email)
    await page.getByRole('button', { name: 'Send reset link' }).click()
    const sent = page.getByText(/emailed your password reset link/i)
    if (await sent.waitFor({ timeout: 5_000 }).then(() => true, () => false)) break
    if (Date.now() > deadline) throw new Error('The reset email request stayed throttled')
    await page.waitForTimeout(5_000)
  }
  return waitForResetLink(ACCOUNT.email)
}

async function chooseNewPassword(page: Page, link: string, password: string) {
  await page.goto(link)
  await page.getByLabel(/^New password/).fill(password)
  await page.getByLabel('Confirm new password').fill(password)
  await page.getByRole('button', { name: 'Reset password' }).click()
}

async function signInWith(browser: Browser, password: string) {
  const context = await browser.newContext()
  try {
    await signIn(await context.newPage(), ACCOUNT.email, password)
  } finally {
    await context.close()
  }
}

test('password recovery through the emailed link, one use only, then the old password stops working', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    const link = await requestResetLink(page)
    await chooseNewPassword(page, link, ACCOUNT.changed)
    await expect(page).toHaveURL(/\/login/)

    // The same link cannot be used a second time.
    await chooseNewPassword(page, link, 'another-secret-2')
    await expect(page.getByRole('alert').first()).toBeVisible()
    await expect(page).toHaveURL(/reset-password/)

    // The old password is refused...
    await page.goto('/login')
    await page.getByLabel('Email').fill(ACCOUNT.email)
    await page.getByLabel('Password').fill(ACCOUNT.original)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page.getByText(/do not match|credentials/i)).toBeVisible()
    await expect(page).toHaveURL(/\/login/)

    // ...and the new one works.
    await signInWith(browser, ACCOUNT.changed)
  } finally {
    // Always give the account its documented password back (waits out the one-per-minute limit).
    const restoreContext = await browser.newContext()
    try {
      const restorePage = await restoreContext.newPage()
      const restoreLink = await requestResetLink(restorePage)
      await chooseNewPassword(restorePage, restoreLink, ACCOUNT.original)
      await expect(restorePage).toHaveURL(/\/login/)
    } finally {
      await restoreContext.close()
      await context.close()
    }
  }

  await signInWith(browser, ACCOUNT.original)
})
