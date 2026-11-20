import { expect, test } from '@playwright/test'
import { ADMIN, USER, apiCall, endActiveAlert, openSession, type Session } from '../support/helpers'

test.describe.configure({ mode: 'serial' })

let admin: Session
let user: Session

test.beforeAll(async ({ browser }) => {
  admin = await openSession(browser, ADMIN)
  user = await openSession(browser, USER)
  await endActiveAlert(admin.context.request)
  // Reload so both pages start from the state the server has now, not from an older run.
  await Promise.all([admin.page.reload(), user.page.reload()])
})

test.afterAll(async () => {
  await user.context.setOffline(false)
  await endActiveAlert(admin.context.request)
  await admin.context.close()
  await user.context.close()
})

const modal = (session: Session) => session.page.getByRole('dialog', { name: 'Alert: where are you?' })

test('reloading before picking restores the active alert and its modal', async () => {
  expect((await apiCall(admin.context.request, 'POST', '/alerts')).status()).toBe(201)
  await expect(modal(user)).toBeVisible()

  await user.page.reload()

  await expect(modal(user)).toBeVisible()
})

test('reloading after picking keeps the pick and does not reopen the modal', async () => {
  await user.page.getByRole('button', { name: 'Square A' }).click()
  await expect(modal(user)).toHaveCount(0)

  await user.page.reload()

  await expect(user.page.getByTestId('square-a').getByText(`${USER.name} (you)`)).toBeVisible()
  await expect(modal(user)).toHaveCount(0)
})

test('an alert that ended while the user was offline is shown once the connection returns', async () => {
  await user.context.setOffline(true)

  const ended = await apiCall(admin.context.request, 'GET', '/alerts/current')
  const { data } = (await ended.json()) as { data: { id: number } }
  expect((await apiCall(admin.context.request, 'POST', `/alerts/${data.id}/end`)).ok()).toBe(true)

  await user.context.setOffline(false)

  await expect(user.page.getByText('This alert has ended. Locations are closed.')).toBeVisible({ timeout: 30_000 })
})

test('chat messages sent while the user was offline are fetched after reconnecting', async () => {
  const text = `e2e-offline-${Date.now().toString(36)}`
  await user.context.setOffline(true)
  await admin.page.getByRole('textbox', { name: 'Message' }).fill(text)
  await admin.page.getByRole('button', { name: 'Send' }).click()
  await expect(admin.page.getByText(text)).toBeVisible()

  await user.context.setOffline(false)

  await expect(user.page.getByText(text)).toBeVisible({ timeout: 30_000 })
})
