'use client'

import { Clock, Hash, BookOpen, X } from 'lucide-react'
import { Story } from '@/types'
import styles from './SearchSuggestions.module.css'

interface SearchSuggestionsProps {
  isOpen: boolean
  query: string
  recentSearches: string[]
  onSelectSearch: (term: string) => void
  onRemoveRecentSearch: (term: string) => void
  onClearRecentSearches: () => void
  availableTags?: string[]
  suggestedStories?: Story[]
  onSelectStory?: (story: Story) => void
}

export function SearchSuggestions({
  isOpen,
  query,
  recentSearches,
  onSelectSearch,
  onRemoveRecentSearch,
  onClearRecentSearches,
  availableTags = [],
  suggestedStories = [],
  onSelectStory,
}: SearchSuggestionsProps) {
  if (!isOpen) return null

  const trimmedQuery = query.trim().toLowerCase()
  const hasQuery = Boolean(trimmedQuery)

  const displayedRecents = hasQuery
    ? recentSearches.filter((s) => s.toLowerCase().includes(trimmedQuery))
    : recentSearches

  const displayedTags = hasQuery
    ? availableTags.filter((t) => t.toLowerCase().includes(trimmedQuery))
    : availableTags.slice(0, 8)

  const hasAnyContent =
    displayedRecents.length > 0 ||
    displayedTags.length > 0 ||
    suggestedStories.length > 0

  if (!hasAnyContent) return null

  return (
    <div className={styles.container}>
      <div className={styles.scrollArea}>
        {/* Group 1: Recent Searches */}
        {displayedRecents.length > 0 && (
          <div className={styles.group}>
            <div className={styles.groupHeader}>
              <span>{hasQuery ? 'Từ khóa gần đây phù hợp' : 'Tìm kiếm gần đây (Tối đa 20)'}</span>
              {!hasQuery && (
                <button
                  type="button"
                  className={styles.clearAllBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClearRecentSearches()
                  }}
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            {displayedRecents.map((term) => (
              <div
                key={term}
                className={styles.item}
                onClick={() => onSelectSearch(term)}
              >
                <div className={styles.itemContent}>
                  <Clock size={12} className={styles.icon} />
                  <span className={styles.label}>{term}</span>
                </div>
                <button
                  type="button"
                  className={styles.deleteItemBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemoveRecentSearch(term)
                  }}
                  aria-label={`Xóa ${term}`}
                  title="Xóa mục này"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Group 2: Matching Tags */}
        {displayedTags.length > 0 && (
          <div className={styles.group} style={{ marginTop: 6 }}>
            <div className={styles.groupHeader}>
              <span>Thẻ chủ đề ({displayedTags.length})</span>
            </div>
            <div className={styles.tagsRow}>
              {displayedTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={styles.tagPill}
                  onClick={() => onSelectSearch(tag)}
                >
                  <Hash size={10} style={{ color: 'var(--olive, #b3c785)' }} />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Group 3: Suggested Stories matching query */}
        {hasQuery && suggestedStories.length > 0 && onSelectStory && (
          <div className={styles.group} style={{ marginTop: 6 }}>
            <div className={styles.groupHeader}>
              <span>Câu chuyện gợi ý</span>
            </div>
            {suggestedStories.slice(0, 4).map((story) => (
              <button
                key={story.id}
                type="button"
                className={styles.item}
                onClick={() => onSelectStory(story)}
              >
                <div className={styles.itemContent}>
                  <BookOpen size={12} className={styles.icon} />
                  <span className={styles.label}>{story.title}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
