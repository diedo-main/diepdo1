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
}

export type ViewMode = 'home' | 'search' | 'reading'

export type StoriesApiResponse = {
  stories: Story[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
