'use client'

import { useState, useEffect } from 'react'
import { Check, Plus, Tag, Trash2, X, Lock, Unlock, FileText } from 'lucide-react'
import { NoteRecord } from '@/types'
import { hasComplexRichText, htmlToCleanPlainText, plainTextToHtml } from '@/lib/notes-format'

interface NotesPanelProps {
  storyTags: string[]
  customTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  note: string
  onNoteChange: (note: string) => void
  savedNote?: string
  onSaveNote: () => void
  onDeleteNote: () => void
  onClose: () => void
  // Multi-notes additions
  notes?: NoteRecord[]
  activeNoteId?: number | null
  onSelectNote?: (noteId: number) => void
  onCreateNewNote?: () => void
}

export function NotesPanel({
  storyTags,
  customTags,
  onAddTag,
  onRemoveTag,
  note,
  onNoteChange,
  savedNote,
  onSaveNote,
  onDeleteNote,
  onClose,
  notes = [],
  activeNoteId = null,
  onSelectNote,
  onCreateNewNote,
}: NotesPanelProps) {
  const [newTag, setNewTag] = useState('')
  const [allowPlainEdit, setAllowPlainEdit] = useState(false)

  // Find active note record
  const currentRecord = notes.find((n) => n.id === activeNoteId) || null
  const rawContent = currentRecord ? currentRecord.content : note
  const isRich = hasComplexRichText(rawContent)

  // Reset allowPlainEdit when active note changes
  useEffect(() => {
    setAllowPlainEdit(false)
  }, [activeNoteId])

  const handleAddTag = () => {
    const trimmed = newTag.trim()
    if (!trimmed) return
    onAddTag(trimmed)
    setNewTag('')
  }

  // Display text is always cleaned from raw HTML tags
  const displayText = htmlToCleanPlainText(note)

  const isReadOnly = isRich && !allowPlainEdit

  return (
    <aside className="notes-panel">
      <div className="notes-header">
        <div>
          <h2>Ghi chú & thẻ</h2>
          <p>Cho câu chuyện này</p>
        </div>
        <button className="close-notes" onClick={onClose} aria-label="Đóng ghi chú">
          <X />
        </button>
      </div>

      {/* Section Thẻ */}
      <div className="note-section">
        <h3>Thẻ</h3>
        <div className="tags">
          {storyTags.map((tag) => (
            <em key={tag}>{tag}</em>
          ))}
          {customTags.map((tag) => (
            <em className="custom-tag" key={tag}>
              {tag}
              <button onClick={() => onRemoveTag(tag)} aria-label={`Xóa thẻ ${tag}`}>
                <X />
              </button>
            </em>
          ))}
          <button
            className="add-tag"
            onClick={() => document.getElementById('tag-input')?.focus()}
          >
            <Plus /> Thêm thẻ
          </button>
        </div>
        <div className="tag-entry">
          <Tag />
          <input
            id="tag-input"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddTag()
              }
            }}
            placeholder="Thẻ mới"
          />
          <button onClick={handleAddTag}>Thêm</button>
        </div>
      </div>

      {/* Section Ghi chú cá nhân (Multi-notes & Rich-text protection) */}
      <div className="note-section personal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3>Ghi chú cá nhân</h3>
          {onCreateNewNote && (
            <button
              type="button"
              onClick={onCreateNewNote}
              style={{
                border: 0,
                background: 'none',
                color: 'var(--olive)',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
              }}
            >
              <Plus size={11} /> Thêm ghi chú
            </button>
          )}
        </div>

        {/* Multi-notes pill list if more than 1 note exists */}
        {notes.length > 0 && onSelectNote && (
          <div
            style={{
              display: 'flex',
              gap: '5px',
              overflowX: 'auto',
              paddingBottom: '8px',
              marginBottom: '10px',
            }}
          >
            {notes.map((n, idx) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelectNote(n.id)}
                style={{
                  border: n.id === activeNoteId ? '1px solid var(--olive)' : '1px solid #3c3d37',
                  borderRadius: '6px',
                  background: n.id === activeNoteId ? 'rgba(179, 199, 133, 0.15)' : '#20211d',
                  color: n.id === activeNoteId ? '#f1efe9' : '#aaa9a2',
                  fontSize: '10.5px',
                  padding: '3px 8px',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FileText size={10} />
                <span>{n.title || `Ghi chú #${idx + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Rich-text Read-only Protection Banner */}
        {isRich && !allowPlainEdit && (
          <div
            style={{
              background: 'rgba(179, 199, 133, 0.08)',
              border: '1px solid rgba(179, 199, 133, 0.25)',
              borderRadius: '7px',
              padding: '8px 10px',
              marginBottom: '10px',
              fontSize: '11px',
              color: '#dcd9cf',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--olive)', fontWeight: 600 }}>
              <Lock size={12} />
              <span>Ghi chú có định dạng rich-text từ V0.5</span>
            </div>
            <p style={{ margin: '4px 0 6px', color: '#aaa9a2', fontSize: '10.5px', lineHeight: 1.4 }}>
              Đang ở chế độ Chỉ đọc (Read-only) để bảo vệ định dạng. Chuyển sang phiên bản <strong>v0.5</strong> để dùng Tiptap rich-text editor.
            </p>
            <button
              type="button"
              onClick={() => setAllowPlainEdit(true)}
              style={{
                border: '1px solid #44453e',
                borderRadius: '5px',
                background: '#22231e',
                color: '#c2c0b6',
                fontSize: '10px',
                padding: '3px 8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Unlock size={10} /> Cho phép sửa dạng văn bản thuần
            </button>
          </div>
        )}

        {isRich && allowPlainEdit && (
          <div
            style={{
              background: 'rgba(212, 180, 108, 0.1)',
              border: '1px solid rgba(212, 180, 108, 0.3)',
              borderRadius: '6px',
              padding: '6px 10px',
              marginBottom: '10px',
              fontSize: '10.5px',
              color: '#d4b46c',
            }}
          >
            ⚠️ Lưu ở chế độ này sẽ đơn giản hóa định dạng rich-text thành các đoạn văn bản.
          </div>
        )}

        <textarea
          value={displayText}
          readOnly={isReadOnly}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={isReadOnly ? 'Ghi chú ở chế độ chỉ đọc...' : 'Viết điều bạn muốn giữ lại...'}
          style={isReadOnly ? { opacity: 0.85, cursor: 'default' } : undefined}
        />

        {!isReadOnly && (
          <button className="save-note" onClick={onSaveNote}>
            <Check /> Lưu ghi chú
          </button>
        )}

        {/* Existing saved note card */}
        {savedNote && (
          <div className="saved-note">
            <div>
              <strong>{currentRecord?.title || 'Bài học'}</strong>
              <button onClick={onDeleteNote} aria-label="Xóa ghi chú">
                <Trash2 />
              </button>
            </div>
            <p>{htmlToCleanPlainText(savedNote)}</p>
          </div>
        )}
      </div>
    </aside>
  )
}
