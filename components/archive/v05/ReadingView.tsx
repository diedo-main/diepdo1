'use client'

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
  note,
  onNoteChange,
  savedNote,
  onSaveNote,
  onDeleteNote,
  loadingDetail = false,
  notes = [],
  activeNoteId = null,
  onSelectNote,
  onCreateNewNote,
}: ReadingViewProps) {
  return (
    <>
      <section className={styles.readingContainer}>
        {/* Sub-header with back button on left and 'Ghi chú & thẻ' on right */}
        <div className={styles.readingSubHeader}>
          <button className={styles.backLink} onClick={onBack}>
            <ArrowLeft size={14} /> Kết quả tìm kiếm
          </button>

          {/* Elevated Notes button in V0.5 */}
          <button
            type="button"
            className={`${styles.notesButton} ${notesOpen ? styles.notesButtonActive : ''}`}
            onClick={notesOpen ? onCloseNotes : onOpenNotes}
            title="Mở bảng ghi chú & thẻ"
          >
            <SquarePen size={13} />
            <span>Ghi chú & thẻ</span>
          </button>
        </div>

        <article>
          <div className={styles.storyHeading}>
            <span className={styles.storyDate}>{story.date}</span>
            <h1 className={styles.storyTitle}>{story.title}</h1>
            <div className={styles.tags}>
              {story.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Audio Player */}
          <AudioPlayer
            duration={story.duration}
            source={story.source}
            downloadUrl={story.audioUrl || story.image}
            playing={playing}
            onTogglePlay={onTogglePlay}
          />

          <div className={styles.confessionSection}>
            {/* Google Docs Banner if source doc exists */}
            {story.sourceDocUrl && (
              <div className={styles.docBanner}>
                <div className={styles.docInfo}>
                  <FileText size={16} className={styles.docIcon} />
                  <span className={styles.docText}>
                    Bản đầy đủ có thể tại Google Docs / Drive đính kèm
                  </span>
                </div>
                <a
                  href={story.sourceDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.docLink}
                >
                  Mở Google Docs <ExternalLink size={12} />
                </a>
              </div>
            )}

            <div className={styles.confessionHeading}>Confession gốc</div>

            {story.extractedSender && (
              <div className={styles.senderBox}>
                <strong>NGƯỜI GỬI:</strong> {story.extractedSender}
              </div>
            )}

            {loadingDetail ? (
              <div style={{ padding: '20px 0', color: '#9d9b93' }}>
                Đang tải đầy đủ nội dung bài viết...
              </div>
            ) : story.confession && story.confession.length > 0 ? (
              <div className={styles.confessionText}>
                {story.confession.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            ) : (
              <div className={styles.confessionText}>
                <p>{story.excerpt}</p>
              </div>
            )}
          </div>
        </article>
      </section>

      {/* Notes Panel V0.5 with Tiptap and Autosave */}
      {notesOpen && (
        <NotesPanel
          storyId={story.id}
          storyTags={story.tags}
          customTags={customTags}
          onAddTag={onAddTag}
          onRemoveTag={onRemoveTag}
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote || (() => {})}
          onCreateNewNote={onCreateNewNote || (() => {})}
          onDeleteNote={onDeleteNote}
          onClose={onCloseNotes}
          onNoteSaved={(updatedNote) => {
            onNoteChange(updatedNote.content)
          }}
        />
      )}
    </>
  )
}

