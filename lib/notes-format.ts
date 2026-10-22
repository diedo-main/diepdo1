/**
 * Utility functions for HTML sanitization, bidirectional conversion,
 * and rich-text format protection between V0 and V0.5.
 */

const DANGEROUS_TAGS_REGEX = /<\/?(?:script|style|iframe|object|embed|applet|meta|link|form|input|button|svg|math)[^>]*>/gi
const EVENT_HANDLER_REGEX = /\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JAVASCRIPT_URL_REGEX = /(?:href|src)\s*=\s*["']?\s*(?:javascript|data):[^"'\s>]+/gi

/**
 * Sanitizes HTML content by stripping dangerous tags, event handlers, and javascript: links.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return ''
  return html
    .replace(DANGEROUS_TAGS_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '')
    .replace(JAVASCRIPT_URL_REGEX, '')
}

/**
 * Checks if HTML string contains complex rich text formatting (headings, lists, blockquotes, styling)
 * that would be degraded or lost if edited with a basic plain-text textarea.
 */
export function hasComplexRichText(content: string): boolean {
  if (!content) return false
  const complexPattern = /<\/?(?:h[1-6]|ul|ol|li|blockquote|strong|b|em|i|u|s|mark|a)[^>]*>/i
  return complexPattern.test(content)
}

/**
 * Decodes standard HTML entities to their character equivalents.
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return ''
  return str
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
}

/**
 * Converts rich text HTML into human-readable plain text without leaking any raw HTML tags.
 * Preserves paragraphs, bullet points, and quotes cleanly.
 */
export function htmlToCleanPlainText(html: string): string {
  if (!html) return ''
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return html.trim()
  }

  const clean = html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, p1) => `> ${p1}\n\n`)
    .replace(/<[^>]+>/g, '') // Strip remaining HTML tags
    .replace(/\n{3,}/g, '\n\n')

  return decodeHtmlEntities(clean).trim()
}

/**
 * Converts plain text into clean, safe HTML paragraphs (<p>...</p>) for V0.5 rich text rendering.
 */
export function plainTextToHtml(text: string): string {
  if (!text || !text.trim()) return '<p></p>'

  // If already valid rich text HTML, sanitize and return
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return sanitizeHtml(text)
  }

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  if (paragraphs.length === 0) return '<p></p>'

  return paragraphs
    .map((p) => {
      const escaped = p
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br />')
      return `<p>${escaped}</p>`
    })
    .join('')
}

