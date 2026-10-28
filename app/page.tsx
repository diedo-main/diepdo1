'use client'

import { useCallback, useEffect, useState } from 'react'
import { NoteRecord, Story, ViewMode, SortField, SortOrder } from '@/types'
import { VersionSwitcher, MigrationModal, UIVersion, v0, v05, v1 } from '@/components/archive'
import { plainTextToHtml } from '@/lib/notes-format'

export default function Page() {
  const [version, setVersion] = useState<UIVersion>('v1')
  const [mounted, setMounted] = useState(false)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [view, setView] = useState<ViewMode>('home')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Story | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [customTags, setCustomTags] = useState<string[]>([])
  const [playing, setPlaying] = useState(false)

  // Server-side Sort & Filter state
  const [sortBy, setSortBy] = useState<SortField>('pub_date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [contentStatus, setContentStatus] = useState<string>('all')
  const [hasNotesFilter, setHasNotesFilter] = useState<boolean | null>(null)

  // Multi-notes & Supabase state
  const [storyNotes, setStoryNotes] = useState<NoteRecord[]>([])
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null)
  const [storyCustomTags, setStoryCustomTags] = useState<string[]>([])

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

  // Load localStorage notes, tags, and UI version on mount (hydration-safe)
  useEffect(() => {
    setMounted(true)

    // Load saved UI version with v1 default
    const savedVersion = localStorage.getItem('life-archive-ui-version') as UIVersion | null
    if (savedVersion === 'v0' || savedVersion === 'v0.5' || savedVersion === 'v1') {
      setVersion(savedVersion)
    } else {
      setVersion('v1')
    }

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

          // Check if legacy localStorage data needs migration
          const legacyMigrated = localStorage.getItem('life-archive-migrated-v05') === 'true'
          const legacyNote = localStorage.getItem('life-archive-note') || ''
          const legacyTags = JSON.parse(localStorage.getItem('life-archive-tags') || '[]')
          if (!legacyMigrated && (legacyNote.trim() || legacyTags.length > 0)) {
            setShowMigrationModal(true)
          }
        } else {
          setIsAuthenticated(false)
        }
      })
      .catch(() => {
        setIsAuthenticated(false)
      })
  }, [])

  function handleVersionChange(newVersion: UIVersion) {
    setVersion(newVersion)
    localStorage.setItem('life-archive-ui-version', newVersion)
  }

  function handleOpenV1Search() {
    handleSearch('')

    const focusSearchInput = () => {
      const input = document.querySelector<HTMLInputElement>('input[aria-label="Tìm kiếm"]')
      if (input) {
        input.focus()
      } else {
        setTimeout(focusSearchInput, 30)
      }
    }
    requestAnimationFrame(() => {
      setTimeout(focusSearchInput, 20)
    })
  }

  // Fetch stories from API with pagination, server-side sort & filter
  const fetchStories = useCallback(
    async (
      searchQuery: string,
      pageNum = 1,
      overrideSortBy?: SortField,
      overrideSortOrder?: SortOrder,
      overrideStatus?: string,
      overrideHasNotes?: boolean | null
    ) => {
      if (pageNum === 1) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      const activeSortBy = overrideSortBy || sortBy
      const activeSortOrder = overrideSortOrder || sortOrder
      const activeStatus = overrideStatus || contentStatus
      const activeHasNotes =
        overrideHasNotes !== undefined ? overrideHasNotes : hasNotesFilter

      let url = `/api/stories?q=${encodeURIComponent(searchQuery || '')}&page=${pageNum}&limit=20&sortBy=${encodeURIComponent(activeSortBy)}&sortOrder=${encodeURIComponent(activeSortOrder)}`

      if (activeStatus && activeStatus !== 'all') {
        url += `&status=${encodeURIComponent(activeStatus)}`
      }
      if (activeHasNotes !== null) {
        url += `&hasNotes=${activeHasNotes}`
      }

      try {
        const res = await fetch(url)
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
    },
    [sortBy, sortOrder, contentStatus, hasNotesFilter]
  )

  // Lazy load / pagination handler
  const handleLoadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return
    fetchStories(query, page + 1)
  }, [fetchStories, query, page, loading, loadingMore, hasMore])

  function handleSortChange(newField: SortField, newOrder: SortOrder) {
    setSortBy(newField)
    setSortOrder(newOrder)
    setPage(1)
    fetchStories(query, 1, newField, newOrder, contentStatus, hasNotesFilter)
  }

  function handleStatusChange(newStatus: string) {
    setContentStatus(newStatus)
    setPage(1)
    fetchStories(query, 1, sortBy, sortOrder, newStatus, hasNotesFilter)
  }

  function handleHasNotesChange(newHasNotes: boolean | null) {
    setHasNotesFilter(newHasNotes)
    setPage(1)
    fetchStories(query, 1, sortBy, sortOrder, contentStatus, newHasNotes)
  }

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

    // Reset notes state for new story
    setStoryNotes([])
    setActiveNoteId(null)
    setNote('')
    setSavedNote('')
    setStoryCustomTags([])

    // 1. Fetch full story detail (complete confession & audio URL)
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

    // 2. Fetch notes from Supabase with localStorage redundancy
    fetch(`/api/stories/${encodeURIComponent(story.id)}/notes`)
      .then((r) => r.json())
      .then((data) => {
        if (data.notes && Array.isArray(data.notes) && data.notes.length > 0) {
          setStoryNotes(data.notes)
          setActiveNoteId(data.notes[0].id)
          setNote(data.notes[0].content)
          setSavedNote(data.notes[0].content)
        } else {
          const localNote =
            localStorage.getItem(`life-archive-note-${story.id}`) ||
            localStorage.getItem('life-archive-note') ||
            ''
          if (localNote.trim()) {
            const fallbackRecord: NoteRecord = {
              id: -1,
              episode_id: story.id,
              user_id: '',
              title: 'Bài học',
              content: plainTextToHtml(localNote),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }
            setStoryNotes([fallbackRecord])
            setActiveNoteId(-1)
            setNote(fallbackRecord.content)
            setSavedNote(fallbackRecord.content)
          }
        }
      })
      .catch((err) => {
        console.error('Lỗi khi tải notes từ Supabase:', err)
        const localNote =
          localStorage.getItem(`life-archive-note-${story.id}`) ||
          localStorage.getItem('life-archive-note') ||
          ''
        if (localNote.trim()) {
          const fallbackRecord: NoteRecord = {
            id: -1,
            episode_id: story.id,
            user_id: '',
            title: 'Bài học',
            content: plainTextToHtml(localNote),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          setStoryNotes([fallbackRecord])
          setActiveNoteId(-1)
          setNote(fallbackRecord.content)
          setSavedNote(fallbackRecord.content)
        }
      })

    // 3. Fetch tags from Supabase
    fetch(`/api/stories/${encodeURIComponent(story.id)}/tags`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tags && Array.isArray(data.tags)) {
          setStoryCustomTags(data.tags.map((t: { name: string }) => t.name))
        }
      })
      .catch((err) => console.error('Lỗi khi tải tags từ Supabase:', err))
  }

  function handleSelectNote(noteId: number) {
    setActiveNoteId(noteId)
    const found = storyNotes.find((n) => n.id === noteId)
    if (found) {
      setNote(found.content)
      setSavedNote(found.content)
    }
  }

  function handleCreateNewNote() {
    setActiveNoteId(null)
    setNote('')
    setSavedNote('')
  }

  async function handleSaveNote() {
    if (!selected) return
    const contentToSave = plainTextToHtml(note)

    try {
      if (activeNoteId) {
        // Update existing note by noteId
        const res = await fetch(
          `/api/stories/${encodeURIComponent(selected.id)}/notes/${activeNoteId}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: contentToSave }),
          }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.note) {
            setStoryNotes((prev) =>
              prev.map((n) => (n.id === activeNoteId ? data.note : n))
            )
            setSavedNote(note)
          }
        }
      } else {
        // Create new note
        const res = await fetch(
          `/api/stories/${encodeURIComponent(selected.id)}/notes`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: contentToSave }),
          }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.note) {
            setStoryNotes((prev) => [...prev, data.note])
            setActiveNoteId(data.note.id)
            setSavedNote(note)
          }
        }
      }
    } catch (err) {
      console.error('Lỗi khi lưu ghi chú lên Supabase:', err)
    }

    // Backup to localStorage for redundancy
    localStorage.setItem('life-archive-note', note)
  }

  async function handleDeleteNote() {
    if (!selected) return

    if (activeNoteId) {
      try {
        await fetch(
          `/api/stories/${encodeURIComponent(selected.id)}/notes/${activeNoteId}`,
          { method: 'DELETE' }
        )
        const remaining = storyNotes.filter((n) => n.id !== activeNoteId)
        setStoryNotes(remaining)
        if (remaining.length > 0) {
          setActiveNoteId(remaining[0].id)
          setNote(remaining[0].content)
          setSavedNote(remaining[0].content)
        } else {
          setActiveNoteId(null)
          setNote('')
          setSavedNote('')
        }
      } catch (err) {
        console.error('Lỗi khi xóa ghi chú trên Supabase:', err)
      }
    } else {
      setNote('')
      setSavedNote('')
    }
    localStorage.removeItem('life-archive-note')
  }

  async function handleAddTag(tag: string) {
    if (!tag) return
    const currentTags = storyCustomTags.length > 0 ? storyCustomTags : customTags
    if (currentTags.includes(tag)) return

    if (selected) {
      try {
        await fetch(`/api/stories/${encodeURIComponent(selected.id)}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tag }),
        })
      } catch (err) {
        console.error('Lỗi khi lưu thẻ lên Supabase:', err)
      }
    }

    const nextStoryTags = [...storyCustomTags, tag]
    setStoryCustomTags(nextStoryTags)

    const nextCustom = [...customTags, tag]
    setCustomTags(nextCustom)
    localStorage.setItem('life-archive-tags', JSON.stringify(nextCustom))
  }

  async function handleRemoveTag(tag: string) {
    if (selected) {
      try {
        await fetch(
          `/api/stories/${encodeURIComponent(selected.id)}/tags/${encodeURIComponent(tag)}`,
          { method: 'DELETE' }
        )
      } catch (err) {
        console.error('Lỗi khi xóa thẻ trên Supabase:', err)
      }
    }

    const nextStoryTags = storyCustomTags.filter((t) => t !== tag)
    setStoryCustomTags(nextStoryTags)

    const next = customTags.filter((item) => item !== tag)
    setCustomTags(next)
    localStorage.setItem('life-archive-tags', JSON.stringify(next))
  }

  function handleResetToHome() {
    setView('home')
    setSelected(null)
    setNotesOpen(false)
  }

  const effectiveCustomTags =
    storyCustomTags.length > 0 ? storyCustomTags : customTags

  return (
    <main className="archive-shell" data-ui-version={version}>
      <header
        className="topbar"
        style={
          version === 'v0.5' || version === 'v1'
            ? {
                position: 'relative',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }
            : undefined
        }
      >
        {!((version === 'v0.5' || version === 'v1') && view === 'home') && (
          <button
            className="wordmark"
            onClick={handleResetToHome}
            style={
              version === 'v0.5' || version === 'v1'
                ? {
                    position: 'static',
                    transform: 'none',
                    textAlign: 'center',
                  }
                : undefined
            }
          >
            Life <span>Archive</span>
          </button>
        )}
        <div
          className="top-actions"
          style={
            version === 'v0.5' || version === 'v1'
              ? {
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }
              : undefined
          }
        >
          {isAuthenticated ? (
            <button
              type="button"
              className="theme-button"
              onClick={handleLogout}
              title={userEmail ? `Tài khoản: ${userEmail} (Nhấn để đăng xuất)` : 'Đăng xuất'}
              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
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

          <VersionSwitcher
            version={version}
            onVersionChange={handleVersionChange}
            mounted={mounted}
          />
        </div>
      </header>

      {/* Version 0: Giữ nguyên 100% components & trải nghiệm gốc */}
      {version === 'v0' ? (
        <>
          {view === 'home' && (
            <v0.HomeView query={query} onQueryChange={setQuery} onSearch={handleSearch} />
          )}

          {view === 'search' && (
            <v0.SearchView
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
            <v0.ReadingView
              story={selected}
              onBack={() => setView('search')}
              notesOpen={notesOpen}
              onOpenNotes={() => setNotesOpen(true)}
              onCloseNotes={() => setNotesOpen(false)}
              playing={playing}
              onTogglePlay={() => setPlaying(!playing)}
              customTags={effectiveCustomTags}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
              note={note}
              onNoteChange={setNote}
              savedNote={savedNote}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
              loadingDetail={loadingDetail}
              notes={storyNotes}
              activeNoteId={activeNoteId}
              onSelectNote={handleSelectNote}
              onCreateNewNote={handleCreateNewNote}
            />
          )}
        </>
      ) : (
        /* Version 0.5: Giao diện V0.5 chuẩn Figma Reference với CSS Modules */
        <>
          {view === 'home' &&
            (version === 'v1' ? (
              <v1.HomeView onOpenSearch={handleOpenV1Search} />
            ) : (
              <v05.HomeView query={query} onQueryChange={setQuery} onSearch={handleSearch} />
            ))}

          {view === 'search' &&
            (version === 'v1' ? (
              <v1.SearchView
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
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                contentStatus={contentStatus}
                onStatusChange={handleStatusChange}
                hasNotesFilter={hasNotesFilter}
                onHasNotesChange={handleHasNotesChange}
                availableTags={effectiveCustomTags}
              />
            ) : (
              <v05.SearchView
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
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                contentStatus={contentStatus}
                onStatusChange={handleStatusChange}
                hasNotesFilter={hasNotesFilter}
                onHasNotesChange={handleHasNotesChange}
                availableTags={effectiveCustomTags}
              />
            ))}

          {view === 'reading' &&
            selected &&
            (version === 'v1' ? (
              <v1.ReadingView
                story={selected}
                onBack={() => setView('search')}
                notesOpen={notesOpen}
                onOpenNotes={() => setNotesOpen(true)}
                onCloseNotes={() => setNotesOpen(false)}
                playing={playing}
                onTogglePlay={() => setPlaying(!playing)}
                customTags={effectiveCustomTags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                note={note}
                onNoteChange={setNote}
                savedNote={savedNote}
                onSaveNote={handleSaveNote}
                onDeleteNote={handleDeleteNote}
                loadingDetail={loadingDetail}
                notes={storyNotes}
                activeNoteId={activeNoteId}
                onSelectNote={handleSelectNote}
                onCreateNewNote={handleCreateNewNote}
              />
            ) : (
              <v05.ReadingView
                story={selected}
                onBack={() => setView('search')}
                notesOpen={notesOpen}
                onOpenNotes={() => setNotesOpen(true)}
                onCloseNotes={() => setNotesOpen(false)}
                playing={playing}
                onTogglePlay={() => setPlaying(!playing)}
                customTags={effectiveCustomTags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
                note={note}
                onNoteChange={setNote}
                savedNote={savedNote}
                onSaveNote={handleSaveNote}
                onDeleteNote={handleDeleteNote}
                loadingDetail={loadingDetail}
                notes={storyNotes}
                activeNoteId={activeNoteId}
                onSelectNote={handleSelectNote}
                onCreateNewNote={handleCreateNewNote}
              />
            ))}
        </>
      )}

      {/* LocalStorage Safe Migration Modal */}
      <MigrationModal
        isOpen={showMigrationModal}
        onClose={() => setShowMigrationModal(false)}
        legacyNote={savedNote}
        legacyTags={customTags}
        onConfirmMigration={async () => {
          if (selected && savedNote) {
            await fetch(`/api/stories/${encodeURIComponent(selected.id)}/notes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: plainTextToHtml(savedNote), title: 'Ghi chú cũ' }),
            }).catch(() => {})
          }
        }}
      />
    </main>
  )
}
