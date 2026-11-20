import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as alertsApi from '../api/alerts'
import type { AlertSnapshot } from '../api/alerts'
import { ApiError } from '../api/client'
import * as echo from '../lib/echo'
import { useAlert } from './useAlert'

vi.mock('../api/alerts', async (importOriginal) => ({ ...(await importOriginal<typeof alertsApi>()), getCurrentAlert: vi.fn(), startAlert: vi.fn(), endAlert: vi.fn(), pickSquare: vi.fn() }))
vi.mock('../lib/echo')

function snapshot(revision: number, status: AlertSnapshot['status'] = 'active', id = 1): AlertSnapshot {
  return { id, status, revision, started_at: '2026-01-01T00:00:00Z', ended_at: null, started_by: null, responses: [] }
}

let live: Parameters<typeof echo.subscribeToAlerts>[0]
const unsubscribe = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(echo.subscribeToAlerts).mockImplementation((handlers) => {
    live = handlers
    return unsubscribe
  })
  vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(null)
})

describe('useAlert', () => {
  it('loads the current alert on mount', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot(2))
    const { result } = renderHook(() => useAlert())

    await waitFor(() => expect(result.current.alert?.revision).toBe(2))
    expect(result.current.loading).toBe(false)
  })

  it('shows an alert that starts live', async () => {
    const { result } = renderHook(() => useAlert())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.alert).toBeNull()

    act(() => live.onAlert(snapshot(1)))

    expect(result.current.alert?.status).toBe('active')
  })

  it('ignores a stale live snapshot', async () => {
    const { result } = renderHook(() => useAlert())
    await waitFor(() => expect(result.current.loading).toBe(false))
    act(() => live.onAlert(snapshot(3, 'ended')))

    act(() => live.onAlert(snapshot(2)))

    expect(result.current.alert?.status).toBe('ended')
  })

  it('does not let an empty first load erase a live alert', async () => {
    let resolve!: (value: AlertSnapshot | null) => void
    vi.mocked(alertsApi.getCurrentAlert).mockReturnValue(new Promise((r) => (resolve = r)))
    const { result } = renderHook(() => useAlert())
    act(() => live.onAlert(snapshot(1)))

    await act(async () => resolve(null))

    expect(result.current.alert?.revision).toBe(1)
  })

  it('catches up after a reconnect, including an alert that ended while offline', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot(1))
    const { result } = renderHook(() => useAlert())
    await waitFor(() => expect(result.current.alert?.status).toBe('active'))
    act(() => live.onStatus('connected')) // first connection: no extra fetch
    expect(alertsApi.getCurrentAlert).toHaveBeenCalledTimes(1)

    act(() => live.onStatus('offline'))
    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot(4, 'ended'))
    act(() => live.onStatus('connected'))

    await waitFor(() => expect(result.current.alert?.status).toBe('ended'))
    expect(alertsApi.getCurrentAlert).toHaveBeenCalledTimes(2)
  })

  it('applies the snapshot returned by start, pick and end', async () => {
    vi.mocked(alertsApi.startAlert).mockResolvedValue(snapshot(1))
    vi.mocked(alertsApi.pickSquare).mockResolvedValue(snapshot(2))
    vi.mocked(alertsApi.endAlert).mockResolvedValue(snapshot(3, 'ended'))
    const { result } = renderHook(() => useAlert())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(() => result.current.start())
    expect(result.current.alert?.revision).toBe(1)
    await act(() => result.current.pick(1, 'b'))
    expect(alertsApi.pickSquare).toHaveBeenCalledWith(1, 'b')
    expect(result.current.alert?.revision).toBe(2)
    await act(() => result.current.end(1))
    expect(result.current.alert?.status).toBe('ended')
  })

  it('lets an action error reach the caller', async () => {
    vi.mocked(alertsApi.pickSquare).mockRejectedValue(new Error('nope'))
    const { result } = renderHook(() => useAlert())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(result.current.pick(1, 'a')).rejects.toThrow('nope')
  })

  it('reports a failed first load and can retry', async () => {
    vi.mocked(alertsApi.getCurrentAlert).mockRejectedValueOnce(new Error('down'))
    const { result } = renderHook(() => useAlert())
    await waitFor(() => expect(result.current.loadFailed).toBe(true))

    vi.mocked(alertsApi.getCurrentAlert).mockResolvedValue(snapshot(1))
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.alert?.revision).toBe(1))
    expect(result.current.loadFailed).toBe(false)
  })

  describe('resync when the state may be stale', () => {
    const conflict = () => new ApiError(409, 'This alert has ended.')

    async function mountWithActiveAlert() {
      vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot(1))
      const hook = renderHook(() => useAlert())
      await waitFor(() => expect(hook.result.current.alert?.status).toBe('active'))
      return hook
    }

    it('a 409 on pick fetches the current alert and still rejects', async () => {
      const { result } = await mountWithActiveAlert()
      vi.mocked(alertsApi.pickSquare).mockRejectedValue(conflict())
      vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot(3, 'ended'))

      await act(async () => {
        await expect(result.current.pick(1, 'a')).rejects.toBeInstanceOf(ApiError)
      })

      await waitFor(() => expect(result.current.alert?.status).toBe('ended'))
    })

    it('a 409 on end fetches the current alert', async () => {
      const { result } = await mountWithActiveAlert()
      vi.mocked(alertsApi.endAlert).mockRejectedValue(conflict())
      vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot(3, 'ended'))

      await act(async () => {
        await expect(result.current.end(1)).rejects.toBeInstanceOf(ApiError)
      })

      await waitFor(() => expect(result.current.alert?.status).toBe('ended'))
    })

    it('other errors do not trigger a fetch', async () => {
      const { result } = await mountWithActiveAlert()
      vi.mocked(alertsApi.pickSquare).mockRejectedValue(new ApiError(500, 'boom'))

      await act(async () => {
        await expect(result.current.pick(1, 'a')).rejects.toBeInstanceOf(ApiError)
      })

      expect(alertsApi.getCurrentAlert).toHaveBeenCalledTimes(1)
    })

    it('fetches when the tab becomes visible, not when it is hidden', async () => {
      const { result } = await mountWithActiveAlert()
      const visibility = vi.spyOn(document, 'visibilityState', 'get')
      vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot(4, 'ended'))

      visibility.mockReturnValue('hidden')
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
      expect(alertsApi.getCurrentAlert).toHaveBeenCalledTimes(1)

      visibility.mockReturnValue('visible')
      act(() => void document.dispatchEvent(new Event('visibilitychange')))
      await waitFor(() => expect(result.current.alert?.status).toBe('ended'))
      visibility.mockRestore()
    })

    it('fetches when the browser is back online', async () => {
      const { result } = await mountWithActiveAlert()
      vi.mocked(alertsApi.getCurrentAlert).mockResolvedValueOnce(snapshot(4, 'ended'))

      act(() => void window.dispatchEvent(new Event('online')))

      await waitFor(() => expect(result.current.alert?.status).toBe('ended'))
    })

    it('keeps what is shown when a resync fails', async () => {
      const { result } = await mountWithActiveAlert()
      vi.mocked(alertsApi.getCurrentAlert).mockRejectedValueOnce(new Error('offline'))

      act(() => void window.dispatchEvent(new Event('online')))

      await waitFor(() => expect(alertsApi.getCurrentAlert).toHaveBeenCalledTimes(2))
      expect(result.current.alert?.status).toBe('active')
    })

    it('removes its listeners on unmount', async () => {
      const { unmount } = await mountWithActiveAlert()
      unmount()

      window.dispatchEvent(new Event('online'))

      expect(alertsApi.getCurrentAlert).toHaveBeenCalledTimes(1)
    })
  })

  it('stops listening on unmount', () => {
    const { unmount } = renderHook(() => useAlert())
    unmount()
    expect(unsubscribe).toHaveBeenCalled()
  })
})
