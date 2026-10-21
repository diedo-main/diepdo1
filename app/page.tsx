'use client'

import { useCallback, useEffect, useState } from 'react'
import { Story, ViewMode } from '@/types'
import { HomeView, SearchView, ReadingView } from '@/components/archive'

export default function Page() {
  const [view, setView] = useState<ViewMode>('home')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Story | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [customTags, setCustomTags] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)

  // API State
  const [stories, setStories] = useState<Story[]>([])
  const [total, setTotal] = useState<number>(0)
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingMore, setLoadingMore] = useState<boolean>(false)
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  // Load localStorage notes and tags on mount
  useEffect(() => {
    setSavedNote(localStorage.getItem('life-archive-note') || '')
    try {
      setCustomTags(JSON.parse(localStorage.getItem('life-archive-tags') || '[]'))
    } catch {
      setCustomTags([])
    }

    // Check current Supabase Auth session
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAuthenticated(true)
          setUserEmail(data.user?.email || null)
        } else {
          setIsAuthenticated(false)
        }
      })
      .catch(() => {
        setIsAuthenticated(false)
      })
  }, [])

  // Fetch stories from API with pagination & lazy load support
  const fetchStories = useCallback(async (searchQuery: string, pageNum = 1) => {
    if (pageNum === 1) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const res = await fetch(
        `/api/stories?q=${encodeURIComponent(searchQuery || '')}&page=${pageNum}&limit=20`
      )
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 401) {
          setIsAuthenticated(false)
          setError('Kho lưu trữ cá nhân được bảo vệ. Vui lòng đăng nhập tài khoản Owner.')
        } else {
          setError(data.error || 'Đã có lỗi xảy ra khi tải dữ liệu câu chuyện.')
        }
        if (pageNum === 1) {
          setStories([])
          setTotal(0)
          setHasMore(false)
        }
      } else {
        setIsAuthenticated(true)
        const newStories: Story[] = data.stories || []
        setStories((prev) => (pageNum === 1 ? newStories : [...prev, ...newStories]))
        setTotal(data.total || 0)
        setHasMore(Boolean(data.hasMore))
        setPage(pageNum)
      }
    } catch {
      setError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra lại đường truyền.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Lazy load / pagination handler
  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    fetchStories(query, page + 1)
  }, [fetchStories, query, page, loading, loadingMore, hasMore])

  // Owner login handler
  async function handleOwnerLogin() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/dev-login', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Đăng nhập tài khoản Owner không thành công.')
      } else {
        setIsAuthenticated(true)
        setUserEmail(data.user?.email || null)
        setPage(1)
        await fetchStories(query, 1)
      }
    } catch {
      setError('Lỗi kết nối khi gửi yêu cầu đăng nhập.')
    } finally {
      setLoading(false)
    }
  }

  // Logout handler
  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      setIsAuthenticated(false)
      setUserEmail(null)
      setStories([])
      setTotal(0)
      setHasMore(false)
      setError('Bạn đã đăng xuất. Vui lòng đăng nhập để tiếp tục.')
    } catch {
      // Ignore
    }
  }

  function handleSearch(value = query) {
    setQuery(value)
    setView('search')
    setPage(1)
    fetchStories(value, 1)
  }

  async function handleOpenStory(story: Story) {
    setSelected(story)
    setNotesOpen(false)
    setPlaying(false)
    setView('reading')
    setLoadingDetail(true)

    // Fetch full story detail (including complete confession and audio URL)
    try {
      const res = await fetch(`/api/stories/${encodeURIComponent(story.id)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.story) {
          setSelected(data.story)
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết câu chuyện:', err)
    } finally {
      setLoadingDetail(false)
    }
  }

  function handleSaveNote() {
    localStorage.setItem('life-archive-note', note)
    setSavedNote(note)
  }

  function handleDeleteNote() {
    setNote('')
    setSavedNote('')
    localStorage.removeItem('life-archive-note')
  }

  function handleAddTag(tag: string) {
    if (!tag || customTags.includes(tag)) return
    const next = [...customTags, tag]
    setCustomTags(next)
    localStorage.setItem('life-archive-tags', JSON.stringify(next))
  }

  function handleRemoveTag(tag: string) {
    const next = customTags.filter((item) => item !== tag)
    setCustomTags(next)
    localStorage.setItem('life-archive-tags', JSON.stringify(next))
  }

  function handleResetToHome() {
    setView('home')
    setSelected(null)
    setNotesOpen(false)
  }

  return (
    <main className="archive-shell">
      <header className="topbar">
        <button className="wordmark" onClick={handleResetToHome}>
          Life <span>Archive</span>
        </button>
        <div className="top-actions">
          {isAuthenticated ? (
            <button
              type="button"
              className="theme-button"
              onClick={handleLogout}
              title={userEmail ? `Tài khoản: ${userEmail} (Nhấn để đăng xuất)` : 'Đăng xuất'}
              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--olive)',
                  display: 'inline-block',
                }}
              />
              Owner
            </button>
          ) : (
            <button
              type="button"
              className="theme-button"
              onClick={handleOwnerLogin}
              style={{ fontSize: '11px' }}
            >
              Đăng nhập
            </button>
          )}
        </div>
      </header>

      {view === 'home' && (
        <HomeView query={query} onQueryChange={setQuery} onSearch={handleSearch} />
      )}

      {view === 'search' && (
        <SearchView
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          results={stories}
          total={total}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          error={error}
          onRetry={() => fetchStories(query, page)}
          onLogin={handleOwnerLogin}
          onSelectStory={handleOpenStory}
        />
      )}

      {view === 'reading' && selected && (
        <ReadingView
          story={selected}
          onBack={() => setView('search')}
          notesOpen={notesOpen}
          onOpenNotes={() => setNotesOpen(true)}
          onCloseNotes={() => setNotesOpen(false)}
          playing={playing}
          onTogglePlay={() => setPlaying(!playing)}
          customTags={customTags}
          onAddTag={handleAddTag}
          onRemoveTag={handleRemoveTag}
          note={note}
          onNoteChange={setNote}
          savedNote={savedNote}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
          loadingDetail={loadingDetail}
        />
      )}
    </main>
  )
}
