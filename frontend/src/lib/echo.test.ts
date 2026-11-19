import { afterEach, describe, expect, it } from 'vitest'
import { echoOptions } from './echo'

afterEach(() => {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

describe('echoOptions', () => {
  it('connects through the page origin, not a separate WebSocket host', () => {
    const options = echoOptions()

    expect(options.broadcaster).toBe('reverb')
    expect(options.wsHost).toBe(window.location.hostname)
    expect(options.forceTLS).toBe(window.location.protocol === 'https:')
  })

  it('authorises private channels through the API with a fresh CSRF header', () => {
    const { channelAuthorization } = echoOptions()
    expect(channelAuthorization.endpoint).toBe('/api/broadcasting/auth')

    document.cookie = 'XSRF-TOKEN=first'
    expect(channelAuthorization.headersProvider()).toEqual({ 'X-XSRF-TOKEN': 'first' })

    // The cookie rotates (e.g. after login): the next attempt must use the new value.
    document.cookie = 'XSRF-TOKEN=second'
    expect(channelAuthorization.headersProvider()).toEqual({ 'X-XSRF-TOKEN': 'second' })
  })

  it('sends no CSRF header when there is no cookie', () => {
    expect(echoOptions().channelAuthorization.headersProvider()).toEqual({})
  })
})
