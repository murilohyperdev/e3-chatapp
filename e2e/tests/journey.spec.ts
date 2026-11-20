import { expect, test } from '@playwright/test'
import { ADMIN, RUN_ID, USER, endActiveAlert, openSession, type Session } from '../support/helpers'

// The item 8 demo as one ordered journey: two independent sessions, administrator and user.
test.describe.configure({ mode: 'serial' })

let admin: Session
let user: Session

test.beforeAll(async ({ browser }) => {
  admin = await openSession(browser, ADMIN)
  user = await openSession(browser, USER)
  await endActiveAlert(admin.context.request) // start from a known state on a shared dev stack
})

test.afterAll(async () => {
  await endActiveAlert(admin.context.request)
  await admin.context.close()
  await user.context.close()
})

test('a chat message reaches the other session without a refresh, in both directions', async () => {
  const fromAdmin = `${RUN_ID} hello from the administrator`
  const fromUser = `${RUN_ID} hello from the user`

  await admin.page.getByRole('textbox', { name: 'Message' }).fill(fromAdmin)
  await admin.page.getByRole('button', { name: 'Send' }).click()
  await expect(admin.page.getByText(fromAdmin)).toBeVisible()
  await expect(user.page.getByText(fromAdmin)).toBeVisible()

  await user.page.getByRole('textbox', { name: 'Message' }).fill(fromUser)
  await user.page.keyboard.press('Enter')
  await expect(admin.page.getByText(fromUser)).toBeVisible()
  await expect(user.page.getByText(fromUser)).toBeVisible()

  // The sender name is shown next to the message.
  await expect(admin.page.getByLabel('Messages').getByText(USER.name).first()).toBeVisible()
})

test('only the administrator sees the alert controls', async () => {
  await expect(admin.page.getByRole('button', { name: 'Start alert' })).toBeVisible()
  await expect(user.page.getByRole('button', { name: 'Start alert' })).toHaveCount(0)
  await expect(user.page.getByRole('button', { name: 'End alert' })).toHaveCount(0)
})

test('an alert started by the administrator opens the location modal for the user, live', async () => {
  await admin.page.getByRole('button', { name: 'Start alert' }).click()

  // Everyone who can submit a location is asked, the administrator included.
  await expect(user.page.getByRole('dialog', { name: 'Alert: where are you?' })).toBeVisible()
  await expect(admin.page.getByRole('dialog', { name: 'Alert: where are you?' })).toBeVisible()
})

test('location picks show up on both boards, each in the chosen square', async () => {
  await admin.page.getByRole('button', { name: 'Square A' }).click()
  await user.page.getByRole('button', { name: 'Square B' }).click()

  await expect(user.page.getByRole('dialog')).toHaveCount(0)
  await expect(admin.page.getByRole('dialog')).toHaveCount(0)
  await expect(user.page.getByTestId('square-b').getByText(`${USER.name} (you)`)).toBeVisible()
  await expect(admin.page.getByTestId('square-b').getByText(USER.name, { exact: true })).toBeVisible()
  await expect(user.page.getByTestId('square-a').getByText(ADMIN.name, { exact: true })).toBeVisible()
  await expect(admin.page.getByTestId('square-a').getByText(`${ADMIN.name} (you)`)).toBeVisible()
})

test('ending the alert closes locations for the user', async () => {
  await admin.page.getByRole('button', { name: 'End alert' }).click()

  await expect(user.page.getByText('This alert has ended. Locations are closed.')).toBeVisible()
  await expect(admin.page.getByText('This alert has ended. Locations are closed.')).toBeVisible()
  // The pick stays on the board as a record.
  await expect(user.page.getByTestId('square-b').getByText(`${USER.name} (you)`)).toBeVisible()
})

test('a new alert starts with no location responses', async () => {
  await admin.page.getByRole('button', { name: 'Start alert' }).click()

  await expect(user.page.getByRole('dialog', { name: 'Alert: where are you?' })).toBeVisible()
  for (const key of ['a', 'b', 'c', 'd']) {
    await expect(admin.page.getByTestId(`square-${key}`).locator('.MuiChip-root')).toHaveCount(0)
  }
})
