'use client'

import { useState } from 'react'
import { Check, Plus, Tag, Trash2, X } from 'lucide-react'

interface NotesPanelProps {
  storyTags: string[]
  customTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  note: string
  onNoteChange: (note: string) => void
  savedNote: string
  onSaveNote: () => void
  onDeleteNote: () => void
  onClose: () => void
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
}: NotesPanelProps) {
  const [newTag, setNewTag] = useState('')

  const handleAddTag = () => {
    const trimmed = newTag.trim()
    if (!trimmed) return
    onAddTag(trimmed)
    setNewTag('')
  }

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

      <div className="note-section personal">
        <h3>Ghi chú cá nhân</h3>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Viết điều bạn muốn giữ lại..."
        />
        <button className="save-note" onClick={onSaveNote}>
          <Check /> Lưu ghi chú
        </button>
        {savedNote && (
          <div className="saved-note">
            <div>
              <strong>Bài học</strong>
              <button onClick={onDeleteNote} aria-label="Xóa ghi chú">
                <Trash2 />
              </button>
            </div>
            <p>{savedNote}</p>
          </div>
        )}
      </div>
    </aside>
  )
}

