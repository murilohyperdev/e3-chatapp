import { expect, test } from '@playwright/test'
import { ADMIN, BASE_URL, USER, apiCall, endActiveAlert, openSession, type Session } from '../support/helpers'

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
  await endActiveAlert(admin.context.request)
  await admin.context.close()
  await user.context.close()
})

async function currentAlert(session: Session) {
  const response = await apiCall(session.context.request, 'GET', '/alerts/current')
  expect(response.ok()).toBe(true)
  return ((await response.json()) as { data: { id: number; status: string } | null }).data
}

test('a regular user cannot start an alert by calling the API directly', async () => {
  const response = await apiCall(user.context.request, 'POST', '/alerts')

  expect(response.status()).toBe(403)
  const alert = await currentAlert(admin)
  expect(alert?.status).not.toBe('active')
})

test('a regular user cannot end an alert by calling the API directly', async () => {
  const started = await apiCall(admin.context.request, 'POST', '/alerts')
  expect(started.status()).toBe(201)
  const { data } = (await started.json()) as { data: { id: number } }

  const response = await apiCall(user.context.request, 'POST', `/alerts/${data.id}/end`)

  expect(response.status()).toBe(403)
  expect((await currentAlert(admin))?.status).toBe('active') // still running
})

test('a visitor is refused on protected endpoints and redirected to sign in', async ({ browser }) => {
  const visitor = await browser.newContext()
  try {
    expect((await visitor.request.get(`${BASE_URL}/api/alerts/current`, { headers: { Accept: 'application/json' } })).status()).toBe(401)
    expect((await visitor.request.get(`${BASE_URL}/api/messages`, { headers: { Accept: 'application/json' } })).status()).toBe(401)
    expect((await visitor.request.get(`${BASE_URL}/api/users`, { headers: { Accept: 'application/json' } })).status()).toBe(401)

    const page = await visitor.newPage()
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
  } finally {
    await visitor.close()
  }
})

test('a user cannot edit another user\'s profile by calling the API directly', async () => {
  const list = (await (await apiCall(user.context.request, 'GET', '/users')).json()) as {
    data: { id: number; name: string }[]
  }
  const other = list.data.find((person) => person.name === ADMIN.name)!

  const response = await apiCall(user.context.request, 'PATCH', `/users/${other.id}`, { name: 'Hacked' })

  expect(response.status()).toBe(403)
})

test('the user session shows no administrator controls even when an alert is active', async () => {
  await user.page.reload()
  await expect(user.page.getByRole('button', { name: 'End alert' })).toHaveCount(0)
  await expect(user.page.getByRole('button', { name: 'Start alert' })).toHaveCount(0)
  expect(USER.name).toBeTruthy()
})
