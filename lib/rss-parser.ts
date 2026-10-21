export type ParsedEpisode = {
  guid: string
  title: string
  pub_date: string
  duration_seconds: number
  audio_url: string
  channel_image_url: string | null
  extracted_sender: string | null
  source_doc_url: string | null
  raw_confession: string
  raw_description_html: string
  content_status: 'full' | 'partial' | 'external' | 'missing'
}

export type ParsedFeed = {
  channelImage: string | null
  episodes: ParsedEpisode[]
}

export const DEFAULT_RSS_URL = 'https://rss.buzzsprout.com/1891921.rss'

/**
 * Parses raw XML from Buzzsprout RSS into typed episode data.
 */
export function parseRssFeed(xmlString: string): ParsedFeed {
  const channelImgMatch =
    xmlString.match(/<channel[\s\S]*?<itunes:image[^>]+href="([^"]+)"/i) ||
    xmlString.match(/<image[\s\S]*?<url>([^<]+)<\/url>/i)
  const channelImage = channelImgMatch ? channelImgMatch[1].trim() : null

  const itemBlocks = xmlString.split(/<item[\s>]/i).slice(1)
  const episodes: ParsedEpisode[] = []

  for (const block of itemBlocks) {
    const itemContent = block.split(/<\/item>/i)[0]

    // GUID
    const guidMatch = itemContent.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)
    const guid = guidMatch
      ? guidMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
      : null
    if (!guid) continue

    // Title
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/i)
    const rawTitle = titleMatch
      ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
      : ''

    // PubDate
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
    const rawPubDate = pubDateMatch ? pubDateMatch[1].trim() : ''
    let pubDate: string | null = null

    if (rawPubDate) {
      const parsedDate = new Date(rawPubDate)
      if (!isNaN(parsedDate.getTime())) {
        pubDate = parsedDate.toISOString()
      } else {
        console.warn(
          `[RSS Parser] Invalid pubDate "${rawPubDate}" for episode GUID "${guid}". Skipping item.`
        )
        continue
      }
    } else {
      console.warn(`[RSS Parser] Missing pubDate for episode GUID "${guid}". Skipping item.`)
      continue
    }

    // Duration (in seconds)
    const durMatch = itemContent.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i)
    let durationSeconds = 0
    if (durMatch) {
      const durStr = durMatch[1].trim()
      if (/^\d+$/.test(durStr)) {
        durationSeconds = parseInt(durStr, 10)
      } else if (durStr.includes(':')) {
        const parts = durStr.split(':').map(Number)
        if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1]
        else if (parts.length === 3)
          durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
      }
    }

    // Audio URL (enclosure)
    const encMatch = itemContent.match(/<enclosure[^>]+url="([^"]+)"/i)
    const audioUrl = encMatch ? encMatch[1].trim() : ''

    // Description / Content
    const descMatch =
      itemContent.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) ||
      itemContent.match(/<description>([\s\S]*?)<\/description>/i)
    const rawHtml = descMatch
      ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
      : ''

    // Extract sender before stripping HTML (supports "Người gửi: ...", "Tâm sự của: ...")
    const senderMatch = rawHtml.match(
      /(?:^|<p>|<br\s*[\/]?>)\s*(?:người gửi|nguoi gui|tâm sự của|tam su cua)[\s: ]*([^\n<.,:;!]{2,40})/i
    )
    let extractedSender: string | null = null
    if (senderMatch) {
      const s = senderMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/[👈👉]/g, '')
        .trim()
      if (s && !/^(mình|em|anh|chị)$/i.test(s)) {
        extractedSender = s
      }
    }

    // Extract Google Docs URL
    const docMatch = rawHtml.match(
      /https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+[^\s<'">]*/i
    )
    const sourceDocUrl = docMatch ? docMatch[0].trim() : null

    // Clean HTML to text preserving paragraphs & newlines
    const cleanText = rawHtml
      .replace(/<a[^>]*href="[^"]*fan_mail[^"]*"[^>]*>[\s\S]*?<\/a>/gi, '')
      .replace(/<a[^>]*>Send us Fan Mail<\/a>/gi, '')
      .replace(/Send us Fan Mail/gi, '')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim()

    // Determine content status
    const hasDoc = Boolean(sourceDocUrl)
    const isSubstantial = cleanText.length >= 250
    let contentStatus: 'full' | 'partial' | 'external' | 'missing' = 'missing'
    if (hasDoc && isSubstantial) contentStatus = 'partial'
    else if (hasDoc && !isSubstantial) contentStatus = 'external'
    else if (!hasDoc && isSubstantial) contentStatus = 'full'
    else contentStatus = 'missing'

    episodes.push({
      guid,
      title: rawTitle,
      pub_date: pubDate,
      duration_seconds: durationSeconds,
      audio_url: audioUrl,
      channel_image_url: channelImage,
      extracted_sender: extractedSender,
      source_doc_url: sourceDocUrl,
      raw_confession: cleanText,
      raw_description_html: rawHtml,
      content_status: contentStatus,
    })
  }

  return { channelImage, episodes }
}

/**
 * Fetches RSS from the remote URL and parses it.
 */
export async function fetchAndParseRssFeed(
  feedUrl = DEFAULT_RSS_URL
): Promise<ParsedFeed> {
  const response = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'LifeArchive/1.0 (+https://life-archive.local)',
    },
    // Buzzsprout cache control
    next: { revalidate: 3600 },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`)
  }

  const xmlText = await response.text()
  return parseRssFeed(xmlText)
}

