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
  const channelImgMatch = xmlString.match(/<channel[\s\S]*?<itunes:image[^>]+href="([^"]+)"/i) ||
                          xmlString.match(/<image[\s\S]*?<url>([^<]+)<\/url>/i)
  const channelImage = channelImgMatch ? channelImgMatch[1].trim() : null

  const itemBlocks = xmlString.split(/<item[\s>]/i).slice(1)
  const episodes = []

  for (const block of itemBlocks) {
    const itemContent = block.split(/<\/item>/i)[0]
    
    const guidMatch = itemContent.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)
    const guid = guidMatch ? guidMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : null
    if (!guid) continue

    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/i)
    const rawTitle = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : ''

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

    const durMatch = itemContent.match(/<itunes:duration>([\s\S]*?)<\/itunes:duration>/i)
    let durationSeconds = 0
    if (durMatch) {
      const durStr = durMatch[1].trim()
      if (/^\d+$/.test(durStr)) {
        durationSeconds = parseInt(durStr, 10)
      } else if (durStr.includes(':')) {
        const parts = durStr.split(':').map(Number)
        if (parts.length === 2) durationSeconds = parts[0] * 60 + parts[1]
        else if (parts.length === 3) durationSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
      }
    }

    const encMatch = itemContent.match(/<enclosure[^>]+url="([^"]+)"/i)
    const audioUrl = encMatch ? encMatch[1].trim() : ''

    const descMatch = itemContent.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i) ||
                      itemContent.match(/<description>([\s\S]*?)<\/description>/i)
    const rawHtml = descMatch ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : ''

    const senderMatch = rawHtml.match(
      /(?:^|<p>|<br\s*[\/]?>)\s*(?:người gửi|nguoi gui|tâm sự của|tam su cua)[\s: ]*([^\n<.,:;!]{2,40})/i
    )
    let extractedSender = null
    if (senderMatch) {
      const s = senderMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[👈👉]/g, '').trim()
      if (s && !/^(mình|em|anh|chị)$/i.test(s)) {
        extractedSender = s
      }
    }

    const docMatch = rawHtml.match(/https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9_-]+[^\s<'">]*/i)
    const sourceDocUrl = docMatch ? docMatch[0].trim() : null

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
      .map(line => line.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim()

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
      content_status: contentStatus
    })
  }

  return { channelImage, episodes }
}

async function runTestImport() {
  console.log('--- BẮT ĐẦU IMPORT THỬ 10 TẬP MỚI NHẤT ---')
  
  // 3. Tải và parse feed
  let xmlText = ''
  if (fs.existsSync('/tmp/tsbv.rss')) {
    xmlText = fs.readFileSync('/tmp/tsbv.rss', 'utf-8')
    console.log('✓ Đọc RSS feed từ cache /tmp/tsbv.rss')
  } else {
    console.log('Fetching RSS from remote URL...')
    const res = await fetch('https://rss.buzzsprout.com/1891921.rss')
    xmlText = await res.text()
  }

  const { channelImage, episodes } = parseFeed(xmlText)
  console.log(`✓ Parse thành công. Tổng số tập trong RSS: ${episodes.length}`)

  const testBatch = episodes.slice(0, 10)
  console.log(`✓ Lấy 10 tập mới nhất để import thử.`)

  // 4. Xin khóa sync
  const workerId = `test-worker-${Date.now()}`
  const { data: lockAcquired, error: lockErr } = await supabase.rpc('acquire_sync_lock', {
    p_worker_id: workerId,
    p_timeout_interval: '5 minutes'
  })

  if (lockErr || !lockAcquired) {
    console.error('Không thể lấy sync lock:', lockErr || 'Lock đang bị giữ')
    process.exit(1)
  }
  console.log(`✓ Đã chiếm database sync lock (worker: ${workerId})`)

  // 5. Ghi sync_logs
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    status: 'running',
    started_at: new Date().toISOString(),
    triggered_by: 'manual_test_10'
  }).select('id').single()

  console.log(`✓ Đã tạo sync_log id: ${logEntry ? logEntry.id : 'N/A'}`)

  // 6. Upsert vào rss_episodes
  const payload = testBatch.map(ep => ({
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
    synced_at: new Date().toISOString()
  }))

  const { data: upsertData, error: upsertErr } = await supabase
    .from('rss_episodes')
    .upsert(payload, { onConflict: 'guid' })
    .select('id, guid, title, extracted_sender, content_status, search_text')

  if (upsertErr) {
    console.error('Lỗi khi upsert vào rss_episodes:', upsertErr)
    await supabase.rpc('release_sync_lock', {
      p_worker_id: workerId,
      p_status: 'failed',
      p_error: upsertErr.message
    })
    process.exit(1)
  }

  console.log(`✓ Upsert thành công ${upsertData.length} tập vào bảng rss_episodes.`)

  // 7. Giải phóng lock và cập nhật log
  await supabase.rpc('release_sync_lock', {
    p_worker_id: workerId,
    p_status: 'completed',
    p_error: null
  })
  console.log(`✓ Đã giải phóng sync lock.`)

  if (logEntry) {
    await supabase.from('sync_logs').update({
      status: 'completed',
      finished_at: new Date().toISOString(),
      total_items: testBatch.length,
      inserted_items: upsertData.length,
      updated_items: 0
    }).eq('id', logEntry.id)
  }

  // 8. Đọc lại từ Supabase để xác minh toàn diện
  console.log('\n--- KẾT QUẢ ĐỐI SOÁT TỪ DATABASE SUPABASE ---')
  const { data: verified, error: readErr } = await supabase
    .from('rss_episodes')
    .select('guid, title, pub_date, duration_seconds, audio_url, extracted_sender, source_doc_url, content_status, raw_confession, search_text')
    .order('pub_date', { ascending: false })
    .limit(10)

  if (readErr) {
    console.error('Lỗi khi đọc dữ liệu đối soát:', readErr)
    process.exit(1)
  }

  console.log(`Đã đọc được ${verified.length} bản ghi thực tế từ Supabase:`)
  verified.forEach((item, index) => {
    console.log(`\n[TẬP ${index + 1}] GUID: ${item.guid}`);
    console.log(`  - Tiêu đề: ${item.title}`);
    console.log(`  - Ngày đăng: ${item.pub_date}`);
    console.log(`  - Thời lượng: ${item.duration_seconds}s (${Math.floor(item.duration_seconds/60)}:${(item.duration_seconds%60).toString().padStart(2, '0')})`);
    console.log(`  - Audio MP3: ${item.audio_url}`);
    console.log(`  - Người gửi: ${item.extracted_sender || '(Không có)'}`);
    console.log(`  - Trạng thái: ${item.content_status}`);
    console.log(`  - Google Docs: ${item.source_doc_url || '(Không có)'}`);
    console.log(`  - Độ dài Confession: ${item.raw_confession ? item.raw_confession.length : 0} ký tự`);
    console.log(`  - Trích đoạn Confession: "${(item.raw_confession || '').slice(0, 100).replace(/\n/g, ' ')}..."`);
    console.log(`  - Trigger search_text: "${(item.search_text || '').slice(0, 100)}..."`);
  })
}

runTestImport().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

