'use client'

import { ArrowLeft, ExternalLink, FileText, MoreHorizontal } from 'lucide-react'
import { Story } from '@/types'
import { AudioPlayer } from './AudioPlayer'
import { NotesPanel } from './NotesPanel'

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
}

/**
 * Renders paragraph text with interactive Google Drive / Docs links.
 */
function renderParagraphContent(paragraph: string, docUrl?: string | null) {
  // Case 1: Matches "👈Nhấn vào đây để đọc đầy đủ nội dung bài" or similar
  const linkMatch = paragraph.match(/^(.*?)(👈?\s*(?:nhấn|click)\s+vào\s+đây[^\n]*)(.*)$/i)
  if (linkMatch && docUrl) {
    const before = linkMatch[1]
    const phrase = linkMatch[2]
    const after = linkMatch[3]

    return (
      <>
        {before}
        <a
          href={docUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--olive)',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
          }}
          title="Mở Google Docs / Drive bài viết gốc"
        >
          {phrase}
          <ExternalLink size={12} style={{ display: 'inline', marginLeft: 2 }} />
        </a>
        {after}
      </>
    )
  }

  // Case 2: Paragraph contains a raw URL like https://docs.google.com/...
  if (paragraph.includes('http://') || paragraph.includes('https://')) {
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = paragraph.split(urlRegex)
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('http://') || part.startsWith('https://')) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--olive)',
                  textDecoration: 'underline',
                  wordBreak: 'break-all',
                }}
              >
                {part} <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            )
          }
          return part
        })}
      </>
    )
  }

  return paragraph
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
}: ReadingViewProps) {
  return (
    <>
      <section className={`reading-view ${notesOpen ? 'with-notes' : ''}`}>
        <article className="story-content">
          <button className="back-link" onClick={onBack}>
            <ArrowLeft /> Kết quả tìm kiếm
          </button>
          <div className="story-heading">
            <small>{story.date}</small>
            <h1>{story.title}</h1>
            <div className="tags">
              {story.tags.map((tag) => (
                <em key={tag}>{tag}</em>
              ))}
            </div>
          </div>
          <button className="icon-button story-menu" aria-label="Mở menu">
            <MoreHorizontal />
          </button>
          <AudioPlayer
            duration={story.duration}
            source={story.source}
            downloadUrl={story.audioUrl || story.image}
            playing={playing}
            onTogglePlay={onTogglePlay}
          />

          <div className="story-text">
            <h3>Confession gốc</h3>

            {/* Dedicated Google Drive Banner when sourceDocUrl is present */}
            {story.sourceDocUrl && (
              <div
                style={{
                  margin: '10px 0 16px',
                  padding: '10px 14px',
                  background: 'rgba(179, 199, 133, 0.08)',
                  border: '1px solid rgba(179, 199, 133, 0.25)',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <FileText size={16} style={{ color: 'var(--olive)', flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: '12px',
                      color: '#eae8e1',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Bài viết gốc có tài liệu Google Docs / Drive đính kèm
                  </span>
                </div>
                <a
                  href={story.sourceDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--olive)',
                    textDecoration: 'none',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: 'rgba(179, 199, 133, 0.15)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  Mở Google Docs <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* Loading detail skeleton */}
            {loadingDetail && (
              <div
                style={{
                  padding: '12px 0',
                  opacity: 0.6,
                  animation: 'pulse 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 14,
                    background: '#2d2e29',
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    width: '95%',
                    height: 14,
                    background: '#2d2e29',
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    width: '85%',
                    height: 14,
                    background: '#2d2e29',
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{
                    width: '90%',
                    height: 14,
                    background: '#2d2e29',
                    borderRadius: 4,
                  }}
                />
              </div>
            )}

            {/* Empty confession notice */}
            {!loadingDetail && story.confession.length === 0 && (
              <p style={{ fontStyle: 'italic', color: '#9d9b93', margin: '8px 0 16px' }}>
                Tập podcast này chưa có văn bản confession đính kèm trong RSS. Bạn có thể nghe trực
                tiếp qua audio player phía trên.
              </p>
            )}

            {/* Paragraphs with interactive Drive links */}
            {!loadingDetail &&
              story.confession.map((paragraph, index) => (
                <p key={index}>{renderParagraphContent(paragraph, story.sourceDocUrl)}</p>
              ))}

            {story.transcript && (
              <div className="transcript">
                <h3>Transcript</h3>
                <p>{story.transcript}</p>
              </div>
            )}
          </div>
        </article>
        <button className="notes-trigger" onClick={onOpenNotes}>
          Ghi chú & thẻ
        </button>
        {notesOpen && (
          <NotesPanel
            storyTags={story.tags}
            customTags={customTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            note={note}
            onNoteChange={onNoteChange}
            savedNote={savedNote}
            onSaveNote={onSaveNote}
            onDeleteNote={onDeleteNote}
            onClose={onCloseNotes}
          />
        )}
      </section>
      {!notesOpen && (
        <button className="floating-notes" onClick={onOpenNotes}>
          Ghi chú & thẻ
        </button>
      )}
    </>
  )
}
