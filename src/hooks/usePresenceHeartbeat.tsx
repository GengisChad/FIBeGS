/**
 * No-op: last_seen_at is updated during tournament finalization only.
 * This hook is kept as a stub to avoid breaking imports.
 */
export function usePresenceHeartbeat(_userId: string | undefined) {
  // Zero cloud cost — presence is tracked via tournament participation
}
