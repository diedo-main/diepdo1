'use client'

import { useEffect, useRef, useState } from 'react'
import { Headphones, Search, User, X } from 'lucide-react'
import { Story, SortField, SortOrder } from '@/types'
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '@/lib/search-history'
import { highlightText } from '@/lib/search-highlight'
import { SearchSuggestions } from './SearchSuggestions'
import { SortFilterMenu } from './SortFilterMenu'
import styles from './SearchView.module.css'

interface SearchViewProps {
  query: string
  onQueryChange: (query: string) => void
  onSearch: (value?: string) => void
  results: Story[]
  onSelectStory: (story: Story) => void
  loading?: boolean
  error?: string | null
  total?: number
  onRetry?: () => void
  onLogin?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void
  sortBy?: SortField
  sortOrder?: SortOrder
  onSortChange?: (field: SortField, order: SortOrder) => void
  contentStatus?: string
  onStatusChange?: (status: string) => void
  hasNotesFilter?: boolean | null
  onHasNotesChange?: (hasNotes: boolean | null) => void
  availableTags?: string[]
}

export function SearchView({
  query,
  onQueryChange,
  onSearch,
  results,
  onSelectStory,
  loading = false,
  error = null,
  total,
  onRetry,
  onLogin,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  sortBy = 'pub_date',
  sortOrder = 'desc',
  onSortChange,
  contentStatus = 'all',
  onStatusChange,
  hasNotesFilter = null,
  onHasNotesChange,
  availableTags = [],
}: SearchViewProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const containerRef = useRef<HTMLFormElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setRecentSearches(getRecentSearches())
  }, [])

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Infinite scroll intersection observer
  useEffect(() => {
    if (!hasMore || loading || loadingMore || !onLoadMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      { rootMargin: '300px' }
    )

    const el = sentinelRef.current
    if (el) observer.observe(el)

    return () => {
      if (el) observer.unobserve(el)
    }
  }, [hasMore, loading, loadingMore, onLoadMore])

  const hasQuery = Boolean(query && query.trim().length > 0)
  const displayCount =
    total !== undefined
      ? `Hiển thị ${results.length}/${total} câu chuyện`
      : `${results.length} câu chuyện`

  // Search-as-you-type with 300ms debounce
  const handleInputChange = (val: string) => {
    onQueryChange(val)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      if (val.trim()) {
        addRecentSearch(val.trim())
      }
      onSearch(val)
    }, 300)
  }

  const handleSelectSearch = (term: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    const updated = addRecentSearch(term)
    setRecentSearches(updated)
    onQueryChange(term)
    setIsFocused(false)
    onSearch(term)
  }

  const handleRemoveRecent = (term: string) => {
    const updated = removeRecentSearch(term)
    setRecentSearches(updated)
  }

  const handleClearAll = () => {
    clearRecentSearches()
    setRecentSearches([])
  }

  return (
    <section className={styles.searchView}>
      <form
        ref={containerRef}
        className={styles.searchBox}
        onSubmit={(e) => {
          e.preventDefault()
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
          if (query.trim()) {
            addRecentSearch(query.trim())
          }
          setIsFocused(false)
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          onSearch()
        }}
      >
        <Search className={styles.searchIcon} />
        <input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setIsFocused(false)
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur()
              }
            }
          }}
          placeholder="Tìm kiếm"
          aria-label="Tìm kiếm"
          className={styles.searchInput}
        />
        {query && (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
              onQueryChange('')
              onSearch('')
            }}
            aria-label="Xóa tìm kiếm"
          >
            <X size={15} />
          </button>
        )}

        {/* Suggestions Popover: Term & tag suggestions only on search results view (stories are already shown in results) */}
        <SearchSuggestions
          isOpen={isFocused}
          query={query}
          recentSearches={recentSearches}
          onSelectSearch={handleSelectSearch}
          onRemoveRecentSearch={handleRemoveRecent}
          onClearRecentSearches={handleClearAll}
          availableTags={availableTags}
          suggestedStories={[]}
          onSelectStory={onSelectStory}
        />
      </form>

      <div className={styles.toolbar}>
        <div className={styles.resultsHeading}>
          <h2>Kết quả tìm kiếm</h2>
          <span>{loading ? 'Đang tải...' : displayCount}</span>
        </div>

        {/* Sort and Filter buttons in results toolbar */}
        {onSortChange && onStatusChange && onHasNotesChange && (
          <SortFilterMenu
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
            contentStatus={contentStatus}
            onStatusChange={onStatusChange}
            hasNotesFilter={hasNotesFilter}
            onHasNotesChange={onHasNotesChange}
          />
        )}
      </div>

      {error ? (
        <div className={styles.emptyState}>
          <p>{error}</p>
          {error.includes('đăng nhập') && onLogin ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={onLogin}
              style={{ margin: '12px auto' }}
            >
              Đăng nhập tài khoản Owner
            </button>
          ) : (
            onRetry && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={onRetry}
                style={{ margin: '12px auto' }}
              >
                Thử lại
              </button>
            )
          )}
        </div>
      ) : results.length === 0 && !loading ? (
        <div className={styles.emptyState}>
          <p>Không tìm thấy câu chuyện nào phù hợp.</p>
        </div>
      ) : (
        <div className={styles.resultsList}>
          {results.map((story) => (
            <article
              key={story.id}
              className={styles.resultCard}
              onClick={() => onSelectStory(story)}
            >
              <div className={styles.tsbvBadge}>#tsbv</div>

              <div className={styles.resultCopy}>
                <div className={styles.resultMeta}>
                  <User size={11} />
                  <span>{story.date}</span>
                </div>
                <strong className={styles.resultTitle}>
                  {highlightText(story.title, query)}
                </strong>
                <span className={styles.resultExcerpt}>
                  {highlightText(story.excerpt, query)}
                </span>
                <div className={styles.tags}>
                  {story.tags.map((tag) => (
                    <span key={tag} className={styles.tag}>
                      {highlightText(tag, query)}
                    </span>
                  ))}
                </div>
              </div>

              {story.duration && (
                <div className={styles.durationBadge}>
                  <Headphones size={12} />
                  <span>{story.duration}</span>
                </div>
              )}
            </article>
          ))}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {loadingMore && (
            <div className={styles.emptyState} style={{ padding: '16px' }}>
              <span>Đang tải thêm câu chuyện...</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
