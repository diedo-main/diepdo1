'use client'

import { Search } from 'lucide-react'

interface HomeViewProps {
  query: string
  onQueryChange: (query: string) => void
  onSearch: (value?: string) => void
}

export function HomeView({ query, onQueryChange, onSearch }: HomeViewProps) {
  return (
    <section className="home-view">
      <form
        className="search-box home-search"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch()
        }}
      >
        <Search />
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm lại một câu chuyện, từ khóa hoặc thẻ..."
          aria-label="Tìm kiếm"
        />
      </form>
    </section>
  )
}

