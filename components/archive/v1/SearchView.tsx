'use client'

import { useEffect, useRef, useState } from 'react'
import { Headphones, X } from 'lucide-react'
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
  total = 0,
  onRetry,
  onLogin,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  sortBy = 'pub_date',
  sortOrder = 'desc',
  onSortChange = () => {},
  contentStatus = 'all',
  onStatusChange = () => {},
  hasNotesFilter = null,
  onHasNotesChange = () => {},
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
    <div className={styles.container}>
      {/* Top Search bar with ⌕ glass icon and Filter button */}
      <div className={styles.searchbar}>
        <form
          ref={containerRef}
          className={styles.searchForm}
          onSubmit={(e) => {
            e.preventDefault()
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            if (query.trim()) {
              addRecentSearch(query.trim())
            }
            setIsFocused(false)
            onSearch(query)
          }}
        >
          <span className={styles.glassIcon} aria-hidden="true">
            ⌕
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Tìm theo câu đã nghe, cảm giác, hoặc một cái tên..."
            aria-label="Tìm kiếm"
            className={styles.searchInput}
          />
          {query && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                onQueryChange('')
                onSearch('')
              }}
              aria-label="Xóa nội dung tìm kiếm"
            >
              <X size={14} />
            </button>
          )}

          {/* Search Suggestions Popover */}
          <SearchSuggestions
            isOpen={isFocused}
            query={query}
            recentSearches={recentSearches}
            onSelectSearch={handleSelectSearch}
            onRemoveRecentSearch={handleRemoveRecent}
            onClearRecentSearches={handleClearAll}
            availableTags={availableTags}
            suggestedStories={results.slice(0, 3)}
            onSelectStory={(story) => {
              setIsFocused(false)
              onSelectStory(story)
            }}
          />
        </form>

        {/* Filter and Sort Popover Menu */}
        <SortFilterMenu
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          contentStatus={contentStatus}
          onStatusChange={onStatusChange}
          hasNotesFilter={hasNotesFilter}
          onHasNotesChange={onHasNotesChange}
        />
      </div>

      {/* Results Header */}
      <div className={styles.resultsHead}>
        <h1>Kết quả tìm kiếm</h1>
        <span className={styles.resultsCount}>
          {loading
            ? 'Đang tải...'
            : `${total > 0 ? `${results.length}/${total}` : results.length} câu chuyện phù hợp`}
        </span>
      </div>

      {/* Error state */}
      {error ? (
        <div className={styles.errorState}>
          <h2 className={styles.errorStateTitle}>Không thể tải câu chuyện</h2>
          <p>{error}</p>
          {error.includes('Owner') && onLogin ? (
            <button
              type="button"
              className={styles.actionButton}
              onClick={onLogin}
            >
              Đăng nhập tài khoản Owner
            </button>
          ) : (
            onRetry && (
              <button
                type="button"
                className={styles.actionButton}
                onClick={onRetry}
              >
                Thử lại
              </button>
            )
          )}
        </div>
      ) : loading && results.length === 0 ? (
        /* Initial Loading Skeleton */
        <div className={styles.skeletonList}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
      ) : results.length === 0 ? (
        /* Empty State */
        <div className={styles.emptyState}>
          <h2 className={styles.emptyStateTitle}>Không tìm thấy câu chuyện phù hợp</h2>
          <p>
            Thử tìm với từ khóa ngắn hơn, tên người gửi, hoặc một mốc thời gian.
          </p>
          {query && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => {
                onQueryChange('')
                onSearch('')
              }}
            >
              Xóa bộ lọc tìm kiếm
            </button>
          )}
        </div>
      ) : (
        /* Stacked Slips List (Quiet Library) */
        <div className={styles.slips}>
          {results.map((story) => (
            <button
              key={story.id}
              type="button"
              className={styles.slip}
              onClick={() => onSelectStory(story)}
            >
              {/* Olive Memory Thread Mark */}
              <span className={styles.threadMark} aria-hidden="true" />

              {/* Story Content */}
              <div className={styles.slipContent}>
                <h2 className={styles.slipTitle}>
                  {highlightText(story.title, query)}
                </h2>
                <p className={styles.slipExcerpt}>
                  {highlightText(story.excerpt, query)}
                </p>

                <div className={styles.tagsRow}>
                  {story.hasNotes && (
                    <span className={styles.noteBadge}>Có ghi chú</span>
                  )}
                  {story.tags.map((tag) => (
                    <span key={tag} className={styles.tagPill}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Meta */}
              <div className={styles.meta}>
                <span>{story.date}</span>
                {story.duration && (
                  <span className={styles.metaDuration}>
                    <Headphones size={11} /> {story.duration}
                  </span>
                )}
              </div>
            </button>
          ))}

          {/* Infinite Scroll Sentinel */}
          {hasMore && (
            <div ref={sentinelRef} className={styles.sentinel}>
              {loadingMore ? 'Đang tải thêm câu chuyện...' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
