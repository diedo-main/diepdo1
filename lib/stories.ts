import { Story } from '@/types'

/**
 * Remove Vietnamese diacritics / accents and normalize to lowercase.
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

/**
 * Format duration in seconds to MM:SS or H:MM:SS.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * Format ISO date string to Vietnamese localized date format (e.g., "15 thg 04, 2026").
 */
export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day} thg ${month}, ${year}`
}

/**
 * Cleans up raw excerpt text by removing redundant sender prefix,
 * Google Docs links, and formatting nicely for story cards.
 */
export function cleanExcerpt(
  rawExcerpt: string | null | undefined,
  sender?: string | null,
  status?: string | null
): string {
  if (!rawExcerpt || !rawExcerpt.trim()) {
    if (status === 'missing') {
      return 'Tập chia sẻ radio qua podcast Tâm Sự Buồn Vui. Nhấn để lắng nghe toàn bộ audio.'
    }
    return 'Tập tâm sự chia sẻ từ podcast Tâm Sự Buồn Vui.'
  }

  let text = rawExcerpt
    // Remove 'Người gửi: ...' or 'Tâm sự của: ...' at start
    .replace(/^(?:người gửi|nguoi gui|tâm sự của|tam su cua)[\s: ]*[^\n]+/i, '')
    // Remove 'Nội dung bài viết: https://...'
    .replace(/(?:nội dung bài viết|link bài viết|doc)[\s: ]*https?:\/\/[^\s]+/gi, '')
    // Remove standalone google doc links
    .replace(/https:\/\/docs\.google\.com\/document\/[^\s]+/gi, '')
    // Clean up leading dashes or punctuation
    .replace(/^[\s\-–—:.]+/, '')
    .trim()

  if (!text || text.length < 20) {
    if (status === 'external') {
      return sender
        ? `Tập tâm sự của ${sender} (nội dung lưu tại Google Docs đính kèm). Nhấn để xem link và nghe audio.`
        : 'Tập tâm sự được lưu tại Google Docs đính kèm. Nhấn để xem link và nghe audio.'
    }
    if (status === 'missing') {
      return 'Tập chia sẻ radio qua podcast Tâm Sự Buồn Vui. Nhấn để lắng nghe toàn bộ audio.'
    }
    return 'Tập tâm sự chia sẻ từ podcast Tâm Sự Buồn Vui.'
  }

  if (text.length > 175) {
    const cut = text.substring(0, 175)
    const lastSpace = cut.lastIndexOf(' ')
    text = (lastSpace > 120 ? cut.substring(0, lastSpace) : cut) + '...'
  }

  return text
}

/**
 * Default fallback image if channel image is missing.
 */
export const DEFAULT_STORY_IMAGE =
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80'

/**
 * Maps database record from `v_stories` or `rss_episodes` to UI `Story` type.
 */
export function mapDbToStory(dbRow: {
  id: string
  guid?: string
  pub_date?: string
  duration_seconds?: number
  audio_url?: string
  source_doc_url?: string | null
  extracted_sender?: string | null
  content_status?: 'full' | 'partial' | 'external' | 'missing'
  title: string
  image_url?: string | null
  channel_image_url?: string | null
  excerpt?: string | null
  confession_text?: string | null
  transcript?: string | null
  tags?: string[] | null
  notes_count?: number
  has_notes?: boolean
  note_snippet?: string | null
}): Story {
  const imageUrl = dbRow.image_url || dbRow.channel_image_url || DEFAULT_STORY_IMAGE

  // Build clean display title with sender when available
  let title = dbRow.title || 'Không có tiêu đề'
  if (
    dbRow.extracted_sender &&
    /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(title.trim())
  ) {
    title = `${title} — ${dbRow.extracted_sender}`
  }

  // Build rich tag list
  const tags: string[] = []
  if (Array.isArray(dbRow.tags) && dbRow.tags.length > 0) {
    tags.push(...dbRow.tags)
  }
  // Auto-generate tags if user has not customized tags yet
  if (tags.length === 0) {
    if (dbRow.extracted_sender) {
      tags.push(dbRow.extracted_sender)
    }
    if (dbRow.content_status === 'full') {
      tags.push('Bản đầy đủ')
    } else if (dbRow.content_status === 'partial') {
      tags.push('Trích đoạn')
    } else if (dbRow.content_status === 'external') {
      tags.push('Google Docs')
    } else if (dbRow.content_status === 'missing') {
      tags.push('Audio podcast')
    }
  }

  // Map source description
  let source = 'Tâm Sự Buồn Vui'
  if (dbRow.extracted_sender) {
    source = `Tâm sự: ${dbRow.extracted_sender}`
  }

  // Parse confession paragraphs
  const confessionParagraphs = dbRow.confession_text
    ? dbRow.confession_text
        .split('\n\n')
        .map((p) => p.trim())
        .filter(Boolean)
    : []

  const excerpt = cleanExcerpt(
    dbRow.excerpt,
    dbRow.extracted_sender,
    dbRow.content_status
  )

  return {
    id: dbRow.id,
    date: formatDate(dbRow.pub_date),
    title,
    excerpt,
    tags,
    image: imageUrl,
    duration: formatDuration(dbRow.duration_seconds),
    source,
    confession: confessionParagraphs,
    transcript: dbRow.transcript || '',
    audioUrl: dbRow.audio_url,
    contentStatus: dbRow.content_status,
    sourceDocUrl: dbRow.source_doc_url,
    extractedSender: dbRow.extracted_sender,
    notesCount: dbRow.notes_count,
    hasNotes: Boolean(dbRow.has_notes),
    noteSnippet: dbRow.note_snippet || null,
  }
}
