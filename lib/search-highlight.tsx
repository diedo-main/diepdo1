import React from 'react'
import { removeVietnameseTones } from './stories'

/**
 * Highlights terms matching the search query within a text string,
 * supporting Vietnamese accented and unaccented variations.
 */
export function highlightText(text: string, query: string): React.ReactNode {
  if (!text) return ''
  const trimmed = query.trim()
  if (!trimmed) return text

  const normalizedQuery = removeVietnameseTones(trimmed)
  const normalizedText = removeVietnameseTones(text)

  if (!normalizedQuery || !normalizedText.includes(normalizedQuery)) {
    return text
  }

  // Find index of match in normalized text
  const matchIndex = normalizedText.indexOf(normalizedQuery)
  if (matchIndex === -1) return text

  const matchLength = normalizedQuery.length
  // Extract original casing/accents from original text
  const before = text.substring(0, matchIndex)
  const match = text.substring(matchIndex, matchIndex + matchLength)
  const after = text.substring(matchIndex + matchLength)

  return (
    <>
      {before}
      <mark
        style={{
          background: 'rgba(179, 199, 133, 0.25)',
          color: '#f1efe9',
          padding: '0 2px',
          borderRadius: '3px',
          fontWeight: 500,
        }}
      >
        {match}
      </mark>
      {highlightText(after, query)}
    </>
  )
}

