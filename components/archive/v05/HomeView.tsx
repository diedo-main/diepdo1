'use client'

import { useState, useEffect, useRef } from 'react'
import { Search } from 'lucide-react'
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
} from '@/lib/search-history'
import { SearchSuggestions } from './SearchSuggestions'
import styles from './HomeView.module.css'

interface HomeViewProps {
  query: string
  onQueryChange: (query: string) => void
  onSearch: (value?: string) => void
}

export function HomeView({ query, onQueryChange, onSearch }: HomeViewProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const containerRef = useRef<HTMLFormElement | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load recent searches on mount
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

  // Search-as-you-type with 300ms debounce
  const handleInputChange = (val: string) => {
    onQueryChange(val)

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (val.trim().length > 0) {
      debounceTimerRef.current = setTimeout(() => {
        addRecentSearch(val.trim())
        onSearch(val)
      }, 300)
    }
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
    <section className={styles.homeView}>
      <h1 className={styles.heroWordmark}>
        Life <span>Archive</span>
      </h1>

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
          onSearch()
        }}
      >
        <Search className={styles.searchIcon} />
        <input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder="Tìm lại một câu chuyện, từ khóa hoặc thẻ..."
          aria-label="Tìm kiếm"
          className={styles.searchInput}
        />

        {/* Suggestions Popover */}
        <SearchSuggestions
          isOpen={isFocused}
          query={query}
          recentSearches={recentSearches}
          onSelectSearch={handleSelectSearch}
          onRemoveRecentSearch={handleRemoveRecent}
          onClearRecentSearches={handleClearAll}
        />
      </form>

      <p className={styles.searchHint}>
        Những câu chuyện nhất, được lưu giữ cẩn thận.
      </p>
    </section>
  )
}
