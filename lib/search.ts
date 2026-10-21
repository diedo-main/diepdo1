import { Story } from '@/types'

/**
 * Filter stories by search query matching title, excerpt, or tags.
 */
export function filterStories(stories: Story[], query: string): Story[] {
  const q = query.trim().toLowerCase()
  if (!q) return stories
  return stories.filter((story) =>
    `${story.title} ${story.excerpt} ${story.tags.join(' ')}`.toLowerCase().includes(q)
  )
}

