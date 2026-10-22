'use client'

import { useState } from 'react'
import {
  X,
  Maximize2,
  Minimize2,
  Plus,
  Check,
  AlertCircle,
  Trash2,
  FileText,
} from 'lucide-react'
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
  onClose: () => void
  onNoteSaved?: (savedNote: NoteRecord) => void
}

export function NotesPanel({
  storyId,
  storyTags,
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
}: NotesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [newTagInput, setNewTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)

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
    onClose()
  }

  const handleAddTagSubmit = () => {
    const trimmed = newTagInput.trim()
    if (!trimmed) return
    onAddTag(trimmed)
    setNewTagInput('')
    setShowTagInput(false)
  }

  return (
    <aside className={`${styles.panel} ${isExpanded ? styles.panelExpanded : ''}`}>
      {/* Header with single save status */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Ghi chú & thẻ</h2>

          {/* Single save status display */}
          <div className={styles.saveStatus}>
            {saveStatus === 'saving' && (
              <span>Đang lưu...</span>
            )}
            {saveStatus === 'saved' && (
              <span className={styles.saveStatusSuccess}>
                <Check size={11} style={{ display: 'inline', marginRight: 3 }} />
                Đã lưu · {lastSavedTime}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className={styles.saveStatusError}>
                <AlertCircle size={11} style={{ display: 'inline', marginRight: 3 }} />
                {errorMessage || 'Lỗi lưu'}
                <button
                  type="button"
                  className={styles.retryButton}
                  onClick={retrySave}
                >
                  Thử lại
                </button>
              </span>
            )}
          </div>
        </div>

        <div className={styles.headerActions}>
          {/* Expand/Collapse writing mode button */}
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Thu nhỏ bảng' : 'Mở rộng chế độ viết'}
            aria-label="Mở rộng chế độ viết"
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Close button */}
          <button
            type="button"
            className={styles.iconButton}
            onClick={handleClose}
            title="Đóng ghi chú"
            aria-label="Đóng ghi chú"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={styles.contentBody}>
        {/* Section Thẻ */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Thẻ câu chuyện</span>
            {!showTagInput && (
              <button
                type="button"
                className={styles.addNoteButton}
                onClick={() => setShowTagInput(true)}
              >
                <Plus size={11} /> Thêm thẻ
              </button>
            )}
          </div>

          <div className={styles.tagsList}>
            {storyTags.map((tag) => (
              <span key={tag} className={styles.tagPill}>
                {tag}
              </span>
            ))}
            {customTags.map((tag) => (
              <span key={tag} className={styles.tagPill}>
                {tag}
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
          </div>

          {showTagInput && (
            <div className={styles.addTagRow}>
              <input
                autoFocus
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTagSubmit()
                  } else if (e.key === 'Escape') {
                    setShowTagInput(false)
                  }
                }}
                placeholder="Tên thẻ mới..."
                className={styles.tagInput}
              />
              <button
                type="button"
                className={styles.confirmTagBtn}
                onClick={handleAddTagSubmit}
              >
                Thêm
              </button>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setShowTagInput(false)}
              >
                <X size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Section Ghi chú cá nhân (Multi-notes & Tiptap) */}
        <div className={styles.section} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle}>Ghi chú cá nhân</span>
            <button
              type="button"
              className={styles.addNoteButton}
              onClick={onCreateNewNote}
            >
              <Plus size={11} /> Ghi chú mới
            </button>
          </div>

          {/* Multi-notes pills list */}
          {notes.length > 0 && (
            <div className={styles.notesSelector}>
              {notes.map((n, idx) => (
                <button
                  key={n.id}
                  type="button"
                  className={`${styles.notePill} ${n.id === activeNoteId ? styles.notePillActive : ''}`}
                  onClick={() => onSelectNote(n.id)}
                >
                  <FileText size={11} />
                  <span>{n.title || `Ghi chú #${idx + 1}`}</span>
                </button>
              ))}
            </div>
          )}

          {/* Tiptap Rich-Text Editor */}
          <div style={{ flex: 1, minHeight: '260px' }}>
            <TiptapEditor
              content={content}
              onChange={handleContentChange}
              placeholder="Một câu chuyện rất chậm. Viết lại vài ý cốt lõi để nhắc lại..."
            />
          </div>

          {/* Delete note button */}
          {activeNoteId && (
            <div className={styles.deleteNoteRow}>
              <button
                type="button"
                className={styles.deleteNoteBtn}
                onClick={onDeleteNote}
              >
                <Trash2 size={12} />
                <span>Xóa ghi chú này</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

