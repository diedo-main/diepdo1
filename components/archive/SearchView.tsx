'use client'

import { useEffect, useRef } from 'react'
import { Headphones, Search, X } from 'lucide-react'
import { Story } from '@/types'

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
}: SearchViewProps) {
  const displayCount =
    total !== undefined
      ? `Hiển thị ${results.length} / ${total} câu chuyện`
      : `${results.length} câu chuyện`

  // Sentinel ref for infinite scroll lazy loading
  const sentinelRef = useRef<HTMLDivElement | null>(null)

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

  return (
    <section className="search-view">
      <form
        className="search-box results-search"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch()
        }}
      >
        <Search />
        <input
          autoFocus
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm kiếm"
          aria-label="Tìm kiếm"
        />
        {query && (
          <button
            type="button"
            className="clear-button"
            onClick={() => {
              onQueryChange('')
              onSearch('')
            }}
            aria-label="Xóa tìm kiếm"
          >
            <X />
          </button>
        )}
      </form>

      <div className="results-heading">
        <h2>Kết quả tìm kiếm</h2>
        <span>{loading ? 'Đang tải...' : displayCount}</span>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div
          className="search-state-box"
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: 'rgba(35, 36, 32, 0.6)',
            borderRadius: 11,
            border: '1px solid #3a3b35',
            margin: '12px 0',
          }}
        >
          <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#f1efe9' }}>{error}</p>
          {onLogin && error.toLowerCase().includes('đăng nhập') ? (
            <button
              type="button"
              className="theme-button"
              onClick={onLogin}
              style={{
                height: '32px',
                padding: '0 16px',
                background: 'var(--olive)',
                color: '#161715',
                fontWeight: 600,
              }}
            >
              Đăng nhập tài khoản Owner
            </button>
          ) : onRetry ? (
            <button
              type="button"
              className="theme-button"
              onClick={onRetry}
              style={{ height: '32px', padding: '0 16px' }}
            >
              Thử lại
            </button>
          ) : null}
        </div>
      )}

      {/* Loading state skeleton (initial load) */}
      {loading && (
        <div className="results-list">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="result-card"
              style={{
                opacity: 0.65,
                animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            >
              <div
                style={{
                  width: 82,
                  height: 95,
                  borderRadius: 8,
                  background: '#282925',
                }}
              />
              <div className="result-copy" style={{ flex: 1 }}>
                <div
                  style={{
                    width: 70,
                    height: 10,
                    background: '#33342e',
                    borderRadius: 4,
                  }}
                />
                <div
                  style={{
                    width: '60%',
                    height: 18,
                    background: '#3a3b34',
                    borderRadius: 4,
                    margin: '4px 0',
                  }}
                />
                <div
                  style={{
                    width: '90%',
                    height: 11,
                    background: '#2b2c27',
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                />
                <div
                  style={{
                    width: '75%',
                    height: 11,
                    background: '#2b2c27',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && (
        <div
          className="search-state-box"
          style={{
            textAlign: 'center',
            padding: '52px 20px',
            color: '#aaa9a2',
            background: 'rgba(30, 31, 28, 0.4)',
            borderRadius: 11,
            border: '1px dashed #353630',
            marginTop: 10,
          }}
        >
          <p
            style={{
              font: '18px Georgia, serif',
              color: '#f1efe9',
              margin: '0 0 8px',
            }}
          >
            Không tìm thấy câu chuyện nào
          </p>
          <span style={{ fontSize: '12px', lineHeight: 1.5, display: 'inline-block' }}>
            {query
              ? `Không có kết quả phù hợp với từ khóa "${query}". Thử tìm kiếm với từ khóa khác (ví dụ: "hạnh phúc", "lắng nghe").`
              : 'Chưa có câu chuyện nào trong kho lưu trữ.'}
          </span>
        </div>
      )}

      {/* Results list */}
      {!loading && !error && results.length > 0 && (
        <div className="results-list">
          {results.map((story, index) => {
            const hasPodcast = Boolean(
              story.audioUrl || (story.duration && story.duration !== '00:00')
            )
            const durationLabel =
              story.duration && story.duration !== '00:00'
                ? story.duration
                : 'Có podcast'

            return (
              <button
                className={`result-card ${index === 0 ? 'active' : ''}`}
                key={story.id}
                onClick={() => onSelectStory(story)}
              >
                <img src={story.image} alt="" />
                <span className="result-copy">
                  <small>{story.date}</small>
                  <strong>{story.title}</strong>
                  <span>{story.excerpt}</span>
                  <span className="tags">
                    {story.tags.map((tag) => (
                      <em key={tag}>{tag}</em>
                    ))}
                  </span>
                </span>
                {hasPodcast && (
                  <span className="podcast-label">
                    <Headphones /> {durationLabel}
                  </span>
                )}
              </button>
            )
          })}

          {/* Loading more skeleton */}
          {loadingMore && (
            <div
              className="result-card"
              style={{
                opacity: 0.6,
                animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            >
              <div
                style={{
                  width: 82,
                  height: 95,
                  borderRadius: 8,
                  background: '#282925',
                }}
              />
              <div className="result-copy" style={{ flex: 1 }}>
                <div style={{ width: 70, height: 10, background: '#33342e', borderRadius: 4 }} />
                <div
                  style={{
                    width: '60%',
                    height: 18,
                    background: '#3a3b34',
                    borderRadius: 4,
                    margin: '4px 0',
                  }}
                />
                <div
                  style={{
                    width: '85%',
                    height: 11,
                    background: '#2b2c27',
                    borderRadius: 4,
                    marginBottom: 4,
                  }}
                />
              </div>
            </div>
          )}

          {/* Lazy load sentinel for IntersectionObserver */}
          {hasMore && <div ref={sentinelRef} style={{ height: 20, width: '100%' }} />}

          {/* Manual load more button as fallback */}
          {hasMore && onLoadMore && (
            <div style={{ textAlign: 'center', margin: '16px 0 6px' }}>
              <button
                type="button"
                className="theme-button"
                onClick={onLoadMore}
                disabled={loadingMore}
                style={{
                  height: '34px',
                  padding: '0 20px',
                  fontSize: '12px',
                  color: '#e4e2da',
                  cursor: 'pointer',
                }}
              >
                {loadingMore
                  ? 'Đang tải thêm câu chuyện...'
                  : `Tải thêm câu chuyện (${results.length} / ${total})`}
              </button>
            </div>
          )}

          {/* End of results message */}
          {!hasMore && results.length > 0 && (
            <div
              style={{
                textAlign: 'center',
                margin: '24px 0 12px',
                color: '#8b8a82',
                fontSize: '12px',
                fontStyle: 'italic',
              }}
            >
              Đã hiển thị toàn bộ {total} câu chuyện
            </div>
          )}
        </div>
      )}
    </section>
  )
}
