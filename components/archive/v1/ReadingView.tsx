'use client'

import { useState } from 'react'
import { ArrowLeft, ExternalLink, FileText, SquarePen } from 'lucide-react'
import { NoteRecord, Story } from '@/types'
import { AudioPlayer } from './AudioPlayer'
import { NotesPanel } from './NotesPanel'
import styles from './ReadingView.module.css'

interface ReadingViewProps {
  story: Story
  onBack: () => void
  notesOpen: boolean
  onOpenNotes: () => void
  onCloseNotes: () => void
  playing: boolean
  onTogglePlay: () => void
  customTags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  note: string
  onNoteChange: (note: string) => void
  savedNote: string
  onSaveNote: () => void
  onDeleteNote: () => void
  loadingDetail?: boolean
  notes?: NoteRecord[]
  activeNoteId?: number | null
  onSelectNote?: (noteId: number) => void
  onCreateNewNote?: () => void
}

export function ReadingView({
  story,
  onBack,
  notesOpen,
  onOpenNotes,
  onCloseNotes,
  playing,
  onTogglePlay,
  customTags,
  onAddTag,
  onRemoveTag,
  note: _note,
  onNoteChange,
  savedNote: _savedNote,
  onSaveNote: _onSaveNote,
  onDeleteNote,
  loadingDetail = false,
  notes = [],
  activeNoteId = null,
  onSelectNote = () => {},
  onCreateNewNote = () => {},
}: ReadingViewProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  return (
    <div className={styles.readingContainer}>
      <div className={styles.readingGrid}>
        {/* Left Column: Article & Audio */}
        <article className={styles.article}>
          <button
            type="button"
            className={styles.backButton}
            onClick={onBack}
            aria-label="Trở về kết quả tìm kiếm"
          >
            <ArrowLeft size={14} />
            <span>Trở về kết quả tìm kiếm</span>
          </button>

          <div className={styles.articleDate}>{story.date}</div>
          <h1 className={styles.articleTitle}>{story.title}</h1>

          <div className={styles.tagsRow}>
            {story.tags.map((tag) => (
              <span key={tag} className={styles.tagPill}>
                {tag}
              </span>
            ))}
          </div>

          {/* Audio Player */}
          <AudioPlayer
            duration={story.duration}
            source={story.source}
            downloadUrl={story.audioUrl || story.image}
            playing={playing}
            onTogglePlay={onTogglePlay}
          />

          {/* Google Docs Banner if attached */}
          {story.sourceDocUrl && (
            <div className={styles.docBanner}>
              <div className={styles.docInfo}>
                <FileText size={16} />
                <span>Bản đầy đủ có thể xem tại Google Docs / Drive đính kèm</span>
              </div>
              <a
                href={story.sourceDocUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.docLink}
              >
                <span>Mở Google Docs</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}

          {/* Confession Heading */}
          <div className={styles.confessionHeader}>Confession gốc</div>

          {story.extractedSender && (
            <div className={styles.senderBox}>
              <strong>NGƯỜI GỬI:</strong> {story.extractedSender}
            </div>
          )}

          {/* Story Body */}
          {loadingDetail ? (
            <div className={styles.loadingDetail}>
              Đang tải đầy đủ nội dung câu chuyện...
            </div>
          ) : story.confession && story.confession.length > 0 ? (
            <div className={styles.confessionBody}>
              {story.confession.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}
            </div>
          ) : (
            <div className={styles.confessionBody}>
              <p>{story.excerpt}</p>
            </div>
          )}
        </article>

        {/* Right Column: Desktop Sticky Note Leaf */}
        <div className={styles.desktopLeaf}>
          <NotesPanel
            storyId={story.id}
            storyTags={story.tags}
            customTags={customTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            notes={notes}
            activeNoteId={activeNoteId}
            onSelectNote={onSelectNote}
            onCreateNewNote={onCreateNewNote}
            onDeleteNote={onDeleteNote}
            onNoteSaved={(updatedNote) => {
              onNoteChange(updatedNote.content)
            }}
          />
        </div>
      </div>

      {/* Floating Action Button for Mobile */}
      <button
        type="button"
        className={styles.mobileNoteBtn}
        onClick={() => {
          setMobileSheetOpen(true)
          onOpenNotes()
        }}
        aria-label="Mở ghi chú và thẻ"
      >
        <SquarePen size={16} />
        <span>Ghi chú & thẻ</span>
        {notes.length > 0 && <span className={styles.badge}>{notes.length}</span>}
      </button>

      {/* Mobile Notes Modal Sheet */}
      {mobileSheetOpen && (
        <NotesPanel
          storyId={story.id}
          storyTags={story.tags}
          customTags={customTags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
          onCreateNewNote={onCreateNewNote}
          onDeleteNote={onDeleteNote}
          isMobileModal
          onClose={() => {
            setMobileSheetOpen(false)
            onCloseNotes()
          }}
          onNoteSaved={(updatedNote) => {
            onNoteChange(updatedNote.content)
          }}
        />
      )}
    </div>
  )
}
