'use client'

import { useState } from 'react'
import { Plus, X, Trash2, Check, AlertCircle } from 'lucide-react'
import { NoteRecord } from '@/types'
import { useAutosaveNote } from '@/lib/hooks/useAutosaveNote'
import { TiptapEditor } from './TiptapEditor'
import styles from './NotesPanel.module.css'

interface NotesPanelProps {
  storyId: string
  storyTags: string[]
  customTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  notes: NoteRecord[]
  activeNoteId: number | null
  onSelectNote: (noteId: number) => void
  onCreateNewNote: () => void
  onDeleteNote: () => void
  onClose?: () => void
  onNoteSaved?: (savedNote: NoteRecord) => void
  isMobileModal?: boolean
}

export function NotesPanel({
  storyId,
  storyTags: _storyTags,
  customTags,
  onAddTag,
  onRemoveTag,
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNewNote,
  onDeleteNote,
  onClose,
  onNoteSaved,
  isMobileModal = false,
}: NotesPanelProps) {
  const [newTagInput, setNewTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Find active note content
  const activeRecord = notes.find((n) => n.id === activeNoteId) || null
  const currentContent = activeRecord ? activeRecord.content : ''

  // Autosave Controller
  const {
    content,
    saveStatus,
    lastSavedTime,
    errorMessage,
    handleContentChange,
    flushSave,
    retrySave,
  } = useAutosaveNote({
    storyId,
    activeNoteId,
    initialContent: currentContent,
    onSaveSuccess: (updatedNote) => {
      if (onNoteSaved) onNoteSaved(updatedNote)
    },
  })

  const handleClose = () => {
    flushSave()
    if (onClose) onClose()
  }

  const handleAddTagSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newTagInput.trim()
    if (!trimmed) return
    onAddTag(trimmed)
    setNewTagInput('')
    setShowTagInput(false)
  }

  const contentJSX = (
    <>
      <div className={styles.leafHeader}>
        <h2 className={styles.leafTitle}>Ghi chú của tôi</h2>
        <div className={styles.saveStatus}>
          {saveStatus === 'saving' && <span>Đang lưu...</span>}
          {saveStatus === 'saved' && (
            <span>
              {lastSavedTime ? `Đã lưu · ${lastSavedTime}` : 'Đã lưu'}
            </span>
          )}
          {saveStatus === 'error' && (
            <span
              className={styles.saveStatusError}
              onClick={retrySave}
              title={errorMessage || 'Lỗi lưu. Nhấn để thử lại'}
            >
              Lỗi lưu (Thử lại)
            </span>
          )}
        </div>
        {isMobileModal && (
          <button
            type="button"
            className={styles.mobileCloseBtn}
            onClick={handleClose}
            aria-label="Đóng bảng ghi chú"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Multi-notes tabs */}
      <div className={styles.notesTabs}>
        {notes.map((n, idx) => {
          const isActive =
            activeNoteId === n.id || (activeNoteId === null && idx === 0 && n.id === -1)
          return (
            <button
              key={n.id || idx}
              type="button"
              className={`${styles.tabItem} ${isActive ? styles.tabItemActive : ''}`}
              onClick={() => onSelectNote(n.id)}
            >
              {n.title || `Bản ghi ${idx + 1}`}
            </button>
          )
        })}

        <button
          type="button"
          className={styles.addNoteBtn}
          onClick={onCreateNewNote}
          title="Tạo bản ghi chú mới"
        >
          <Plus size={11} />
          <span>Thêm ghi chú</span>
        </button>

        {/* Delete current note button */}
        {notes.length > 0 && (
          <div style={{ marginLeft: 'auto' }}>
            {showDeleteConfirm ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#e07a5f' }}>Xóa bản này?</span>
                <button
                  type="button"
                  style={{
                    border: 0,
                    background: '#e07a5f',
                    color: '#fff',
                    borderRadius: 3,
                    fontSize: 10,
                    padding: '2px 5px',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    onDeleteNote()
                    setShowDeleteConfirm(false)
                  }}
                >
                  Có
                </button>
                <button
                  type="button"
                  style={{
                    border: '1px solid #4a4e42',
                    background: 'transparent',
                    color: '#c2c0b8',
                    borderRadius: 3,
                    fontSize: 10,
                    padding: '2px 5px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Không
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={styles.deleteNoteBtn}
                onClick={() => setShowDeleteConfirm(true)}
                title="Xóa ghi chú hiện tại"
              >
                <Trash2 size={11} />
                <span>Xóa</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tiptap Editor */}
      <TiptapEditor
        content={content}
        onChange={handleContentChange}
        placeholder="Viết điều bạn muốn giữ lại..."
      />

      {/* Tags section */}
      <div className={styles.tagsSection}>
        <div className={styles.tagsTitle}>Thẻ bài học & ghi nhớ</div>
        <div className={styles.tagsList}>
          {customTags.map((tag) => (
            <span key={tag} className={styles.tagPill}>
              <span>{tag}</span>
              <button
                type="button"
                className={styles.removeTagBtn}
                onClick={() => onRemoveTag(tag)}
                aria-label={`Xóa thẻ ${tag}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}

          {showTagInput ? (
            <form onSubmit={handleAddTagSubmit} className={styles.tagInputForm}>
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Tên thẻ..."
                className={styles.tagInput}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setShowTagInput(false)
                }}
              />
              <button type="submit" className={styles.tagSubmitBtn}>
                Thêm
              </button>
              <button
                type="button"
                className={styles.removeTagBtn}
                onClick={() => setShowTagInput(false)}
              >
                <X size={12} />
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={styles.addTagTrigger}
              onClick={() => setShowTagInput(true)}
            >
              <Plus size={10} />
              <span>Thêm thẻ</span>
            </button>
          )}
        </div>
      </div>
    </>
  )

  if (isMobileModal) {
    return (
      <div
        className={styles.mobileOverlay}
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
        aria-label="Bảng ghi chú và thẻ"
      >
        <div
          className={styles.mobileSheet}
          onClick={(e) => e.stopPropagation()}
        >
          {contentJSX}
        </div>
      </div>
    )
  }

  return <aside className={styles.noteLeaf}>{contentJSX}</aside>
}
