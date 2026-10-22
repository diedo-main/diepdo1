/**
 * Manages up to 20 recent search terms in browser localStorage.
 */

const STORAGE_KEY = 'life-archive-recent-searches'
const MAX_RECENT_ITEMS = 20

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT_ITEMS) : []
  } catch {
    return []
  }
}

export function addRecentSearch(term: string): string[] {
  if (typeof window === 'undefined') return []
  const clean = term.trim()
  if (!clean) return getRecentSearches()

  const current = getRecentSearches().filter(
    (t) => t.toLowerCase() !== clean.toLowerCase()
  )
  const updated = [clean, ...current].slice(0, MAX_RECENT_ITEMS)

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Storage might be full or disabled
  }

  return updated
}

export function removeRecentSearch(term: string): string[] {
  if (typeof window === 'undefined') return []
  const clean = term.trim().toLowerCase()
  const updated = getRecentSearches().filter(
    (t) => t.toLowerCase() !== clean
  )

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {
    // Storage error
  }

  return updated
}

export function clearRecentSearches(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage error
  }
}

