import type { AlertSnapshot } from '../api/alerts'

/**
 * Decides which snapshot to show when a new one arrives (from an HTTP response, a
 * live event or a refetch). Every snapshot is complete, so we only have to pick the
 * newest: a higher alert id wins, and for the same alert a higher revision wins.
 * An equal revision is the same data, so taking it is harmless (idempotent).
 */
export function applySnapshot(current: AlertSnapshot | null, incoming: AlertSnapshot): AlertSnapshot {
  if (!current || incoming.id > current.id) return incoming
  if (incoming.id < current.id) return current
  return incoming.revision >= current.revision ? incoming : current
}
