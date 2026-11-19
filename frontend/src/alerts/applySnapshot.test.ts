import { describe, expect, it } from 'vitest'
import type { AlertSnapshot } from '../api/alerts'
import { applySnapshot } from './applySnapshot'

function snapshot(id: number, revision: number, status: AlertSnapshot['status'] = 'active'): AlertSnapshot {
  return { id, status, revision, started_at: '2026-01-01T00:00:00Z', ended_at: null, started_by: null, responses: [] }
}

describe('applySnapshot', () => {
  it('takes the first snapshot', () => {
    expect(applySnapshot(null, snapshot(1, 1))).toEqual(snapshot(1, 1))
  })

  it('a higher revision of the same alert wins', () => {
    expect(applySnapshot(snapshot(1, 2), snapshot(1, 3)).revision).toBe(3)
  })

  it('a stale (lower revision) snapshot is ignored', () => {
    const current = snapshot(1, 3, 'ended')
    expect(applySnapshot(current, snapshot(1, 2))).toBe(current)
  })

  it('the same revision is idempotent', () => {
    const incoming = snapshot(1, 2)
    expect(applySnapshot(snapshot(1, 2), incoming)).toBe(incoming)
  })

  it('a newer alert replaces an older one even with a lower revision', () => {
    expect(applySnapshot(snapshot(1, 9, 'ended'), snapshot(2, 1)).id).toBe(2)
  })

  it('an older alert never replaces a newer one', () => {
    const current = snapshot(2, 1)
    expect(applySnapshot(current, snapshot(1, 9, 'ended'))).toBe(current)
  })
})
