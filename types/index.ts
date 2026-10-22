export type ContentStatus = 'full' | 'partial' | 'external' | 'missing'

export type Story = {
  id: string
  date: string
  title: string
  excerpt: string
  tags: string[]
  image: string
  duration: string
  source: string
  confession: string[]
  transcript: string
  // Extended fields for real RSS data
  audioUrl?: string
  contentStatus?: ContentStatus
  sourceDocUrl?: string | null
  extractedSender?: string | null
  notesCount?: number
  hasNotes?: boolean
  noteSnippet?: string | null
}

export type ViewMode = 'home' | 'search' | 'reading'

export type StoriesApiResponse = {
  stories: Story[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface NoteRecord {
  id: number
  episode_id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface TagRecord {
  id: number
  name: string
  created_at?: string
}

export type SortField =
  | 'pub_date'
  | 'title'
  | 'extracted_sender'
  | 'duration_seconds'
  | 'content_status'
  | 'source'
  | 'id'
  | 'guid'

export type SortOrder = 'asc' | 'desc'
