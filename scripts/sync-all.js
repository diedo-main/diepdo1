const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// 1. Load env from .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const env = {}
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceKey) {
  console.error('Missing Supabase configuration in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

// 2. Inline RSS parser (same as lib/rss-parser.ts)
function parseFeed(xmlString) {
  const channelImgMatch =
    xmlString.match(/<channel[\s\S]*?<itunes:image[^>]+href="([^"]+)"/i) ||
    xmlString.match(/<image[\s\S]*?<url>([^<]+)<\/url>/i)
  const channelImage = channelImgMatch ? channelImgMatch[1].trim() : null

  const itemBlocks = xmlString.split(/<item[\s>]/i).slice(1)
  const episodes = []

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

    // PubDate with validation
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)
    const rawPubDate = pubDateMatch ? pubDateMatch[1].trim() : ''
    let pubDate = null
    if (rawPubDate) {
      const parsedDate = new Date(rawPubDate)
      if (!isNaN(parsedDate.getTime())) {
        pubDate = parsedDate.toISOString()
      } else {
        console.warn(`[RSS Parser] Invalid pubDate "${rawPubDate}" for GUID "${guid}". Skipping item.`)
        continue
      }
    } else {
      console.warn(`[RSS Parser] Missing pubDate for GUID "${guid}". Skipping item.`)
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
    let extractedSender = null
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
    let contentStatus = 'missing'
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

async function performSync(passName = 'ĐỒNG BỘ TOÀN BỘ') {
  console.log(`\n========================================`)
  console.log(`=== BẮT ĐẦU: ${passName} ===`)
  console.log(`========================================`)

  const startTime = Date.now()

  // 1. Tải và parse feed
  let xmlText = ''
  if (fs.existsSync('/tmp/tsbv.rss')) {
    xmlText = fs.readFileSync('/tmp/tsbv.rss', 'utf-8')
    console.log('✓ Đọc RSS feed từ cache /tmp/tsbv.rss (6.6MB)')
  } else {
    console.log('Fetching RSS from remote URL https://rss.buzzsprout.com/1891921.rss...')
    const res = await fetch('https://rss.buzzsprout.com/1891921.rss')
    xmlText = await res.text()
  }

  const { channelImage, episodes } = parseFeed(xmlText)
  console.log(`✓ Parse thành công toàn bộ feed: ${episodes.length} tập.`)

  // 2. Xin khóa đồng bộ
  const workerId = `full-sync-worker-${Date.now()}`
  const { data: lockAcquired, error: lockErr } = await supabase.rpc('acquire_sync_lock', {
    p_worker_id: workerId,
    p_timeout_interval: '15 minutes',
  })

  if (lockErr || !lockAcquired) {
    console.error('Không thể lấy sync lock:', lockErr ? lockErr.message : 'Lock đang bị chiếm!')
    process.exit(1)
  }
  console.log(`✓ Đã chiếm sync lock (Worker ID: ${workerId})`)

  // 3. Tạo log sync
  const { data: logEntry } = await supabase
    .from('sync_logs')
    .insert({
      status: 'running',
      started_at: new Date().toISOString(),
      triggered_by: passName.toLowerCase().replace(/\s+/g, '_'),
    })
    .select('id')
    .single()

  const syncLogId = logEntry ? logEntry.id : null
  console.log(`✓ Đã tạo sync_logs id: ${syncLogId}`)

  // 4. Batch Upsert theo lô 50 tập
  const CHUNK_SIZE = 50
  const totalChunks = Math.ceil(episodes.length / CHUNK_SIZE)
  let processedCount = 0
  let errorCount = 0

  const contentStatusCounts = {
    full: 0,
    partial: 0,
    external: 0,
    missing: 0,
  }

  console.log(`\nBắt đầu upsert ${episodes.length} tập theo ${totalChunks} lô (mỗi lô ${CHUNK_SIZE} tập):`)

  for (let i = 0; i < episodes.length; i += CHUNK_SIZE) {
    const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1
    const chunk = episodes.slice(i, i + CHUNK_SIZE)

    const payload = chunk.map((ep) => {
      contentStatusCounts[ep.content_status] =
        (contentStatusCounts[ep.content_status] || 0) + 1

      return {
        guid: ep.guid,
        title: ep.title,
        pub_date: ep.pub_date,
        duration_seconds: ep.duration_seconds,
        audio_url: ep.audio_url,
        channel_image_url: ep.channel_image_url || channelImage,
        extracted_sender: ep.extracted_sender,
        source_doc_url: ep.source_doc_url,
        raw_confession: ep.raw_confession,
        raw_description_html: ep.raw_description_html,
        content_status: ep.content_status,
        synced_at: new Date().toISOString(),
      }
    })

    let success = false
    let lastErr = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error: upsertErr } = await supabase
        .from('rss_episodes')
        .upsert(payload, { onConflict: 'guid' })

      if (!upsertErr) {
        success = true
        processedCount += chunk.length
        break
      }

      lastErr = upsertErr.message
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)))
    }

    if (success) {
      process.stdout.write(`  [Lô ${chunkIndex}/${totalChunks}] Đã lưu ${processedCount}/${episodes.length} tập...\r`)
    } else {
      errorCount += chunk.length
      console.error(`\n❌ Lỗi tại lô ${chunkIndex}: ${lastErr}`)
    }
  }

  const durationMs = Date.now() - startTime
  console.log(`\n✓ Hoàn tất xử lý ${processedCount}/${episodes.length} tập trong ${(durationMs / 1000).toFixed(2)}s.`)

  // 5. Cập nhật sync_logs
  if (syncLogId) {
    await supabase
      .from('sync_logs')
      .update({
        status: errorCount === 0 ? 'completed' : 'failed',
        finished_at: new Date().toISOString(),
        total_items: episodes.length,
        inserted_items: processedCount,
        updated_items: 0,
        error_message: errorCount > 0 ? `Lỗi tại ${errorCount} bản ghi` : null,
      })
      .eq('id', syncLogId)
  }

  // 6. Giải phóng sync lock
  const { data: lockReleased, error: relErr } = await supabase.rpc('release_sync_lock', {
    p_worker_id: workerId,
    p_status: errorCount === 0 ? 'completed' : 'failed',
    p_error: errorCount > 0 ? `Lỗi ${errorCount} bản ghi` : null,
  })

  if (relErr || !lockReleased) {
    console.error('⚠️ Cảnh báo: Không thể giải phóng sync lock:', relErr ? relErr.message : 'Lock không khớp')
  } else {
    console.log(`✓ Đã giải phóng sync lock thành công.`)
  }

  return {
    totalFeed: episodes.length,
    processedCount,
    errorCount,
    durationMs,
    contentStatusCounts,
  }
}

async function main() {
  // Pass 1: Full import
  const result1 = await performSync('LẦN 1: IMPORT TOÀN BỘ')

  // Đọc thống kê thực tế từ DB sau lần 1
  const { count: countAfter1, error: countErr1 } = await supabase
    .from('rss_episodes')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📊 THỐNG KÊ SAU LẦN 1:`)
  console.log(`  - Tổng số dòng trong bảng rss_episodes: ${countAfter1}`)
  console.log(`  - Số tập phân loại content_status:`, result1.contentStatusCounts)

  // Pass 2: Re-sync test để kiểm tra Idempotency (không sinh bản ghi trùng)
  console.log('\n--- BẮT ĐẦU KIỂM TRA TÍNH BẤT BIẾN (IDEMPOTENCY / RE-SYNC) ---')
  await performSync('LẦN 2: ĐỒNG BỘ LẠI (IDEMPOTENCY TEST)')

  const { count: countAfter2, error: countErr2 } = await supabase
    .from('rss_episodes')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📊 THỐNG KÊ SAU LẦN 2:`)
  console.log(`  - Tổng số dòng trong bảng rss_episodes: ${countAfter2}`)
  if (countAfter1 === countAfter2) {
    console.log(`✅ XÁC NHẬN BẤT BIẾN THÀNH CÔNG: Số dòng không thay đổi (${countAfter1} == ${countAfter2}). Không có bản ghi trùng lặp!`)
  } else {
    console.error(`❌ CẢNH BÁO: Số dòng bị thay đổi từ ${countAfter1} thành ${countAfter2}!`)
  }

  // Lấy mẫu các tập cũ nhất và mới nhất từ DB
  console.log('\n--- ĐỐI SOÁT DỮ LIỆU TẬP MỚI NHẤT & CŨ NHẤT TỪ DB ---')
  const { data: newest } = await supabase
    .from('rss_episodes')
    .select('guid, title, pub_date, duration_seconds, content_status, extracted_sender')
    .order('pub_date', { ascending: false })
    .limit(3)

  console.log('3 tập mới nhất:', newest)

  const { data: oldest } = await supabase
    .from('rss_episodes')
    .select('guid, title, pub_date, duration_seconds, content_status, extracted_sender')
    .order('pub_date', { ascending: true })
    .limit(3)

  console.log('3 tập cũ nhất:', oldest)
}

main().catch(err => {
  console.error('Lỗi nghiêm trọng:', err)
  process.exit(1)
})

