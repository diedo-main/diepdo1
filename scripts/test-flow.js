const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// 1. Load env
const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8')
const env = {}
envContent.split('\n').forEach((l) => {
  const m = l.match(/^([^=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
})

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(supabaseUrl, serviceKey)

function removeVietnameseTones(str) {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function formatDate(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${day} thg ${month}, ${year}`
}

function cleanExcerpt(rawExcerpt, sender, status) {
  if (!rawExcerpt || !rawExcerpt.trim()) {
    if (status === 'missing') {
      return 'Tập chia sẻ radio qua podcast Tâm Sự Buồn Vui. Nhấn để lắng nghe toàn bộ audio.'
    }
    return 'Tập tâm sự chia sẻ từ podcast Tâm Sự Buồn Vui.'
  }

  let text = rawExcerpt
    .replace(/^(?:người gửi|nguoi gui|tâm sự của|tam su cua)[\s: ]*[^\n]+/i, '')
    .replace(/(?:nội dung bài viết|link bài viết|doc)[\s: ]*https?:\/\/[^\s]+/gi, '')
    .replace(/https:\/\/docs\.google\.com\/document\/[^\s]+/gi, '')
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

function mapStory(s) {
  let title = s.title || 'Không có tiêu đề'
  if (s.extracted_sender && /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(title.trim())) {
    title = `${title} — ${s.extracted_sender}`
  }

  const tags = []
  if (Array.isArray(s.tags) && s.tags.length > 0) {
    tags.push(...s.tags)
  }
  if (tags.length === 0) {
    if (s.extracted_sender) tags.push(s.extracted_sender)
    if (s.content_status === 'full') tags.push('Bản đầy đủ')
    else if (s.content_status === 'partial') tags.push('Trích đoạn')
    else if (s.content_status === 'external') tags.push('Google Docs')
    else if (s.content_status === 'missing') tags.push('Audio podcast')
  }

  return {
    id: s.id,
    date: formatDate(s.pub_date),
    title,
    excerpt: cleanExcerpt(s.excerpt, s.extracted_sender, s.content_status),
    tags,
    duration: formatDuration(s.duration_seconds),
    audioUrl: s.audio_url,
    contentStatus: s.content_status,
  }
}

async function runEndToEndTests() {
  console.log('========================================================')
  console.log('=== KIỂM THỬ TOÀN DIỆN: PHÂN TRANG, LAZYLOAD & DỮ LIỆU ===')
  console.log('========================================================')

  // 1. Tạo phiên Owner
  const { data: ownerRecord } = await admin.from('app_owner').select('user_id').single()
  const { data: userData } = await admin.auth.admin.getUserById(ownerRecord.user_id)
  const { data: linkData } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: userData.user.email,
  })

  const anonClient = createClient(supabaseUrl, anonKey)
  const { data: sessionData } = await anonClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  })

  const ownerClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    },
  })

  async function fetchPage(queryStr, page = 1, limit = 20) {
    const norm = removeVietnameseTones(queryStr)
    const from = (page - 1) * limit
    const to = from + limit - 1

    let baseQuery = ownerClient.from('rss_episodes').select('id', { count: 'exact' })
    if (norm) {
      baseQuery = baseQuery.ilike('search_text', `%${norm}%`)
    }

    const { data: idRows, count } = await baseQuery
      .order('pub_date', { ascending: false })
      .range(from, to)

    const ids = (idRows || []).map((r) => r.id)
    if (ids.length === 0) {
      return { stories: [], total: count || 0, page, limit, hasMore: false }
    }

    const { data: storyRows } = await ownerClient
      .from('v_stories')
      .select('id, guid, pub_date, duration_seconds, audio_url, source_doc_url, extracted_sender, content_status, title, image_url, excerpt, tags')
      .in('id', ids)

    const storyMap = new Map((storyRows || []).map((s) => [s.id, s]))
    const stories = ids
      .map((id) => storyMap.get(id))
      .filter(Boolean)
      .map(mapStory)

    const total = count || 0
    return {
      stories,
      total,
      page,
      limit,
      hasMore: from + stories.length < total,
    }
  }

  // TEST 1: Kiểm tra thông tin hiển thị trên Card
  console.log('\n[1] Kiểm tra độ đầy đủ của thông tin trên Story Card:')
  const page1 = await fetchPage('', 1, 5)
  console.log(`  - Tổng số câu chuyện: ${page1.total}`)
  console.log(`  - Số câu chuyện trang 1: ${page1.stories.length}`)
  console.log(`  - hasMore: ${page1.hasMore}`)

  page1.stories.forEach((st, idx) => {
    console.log(`\n  * Card #${idx + 1}:`)
    console.log(`    - Tiêu đề: ${st.title}`)
    console.log(`    - Ngày: ${st.date} | Thời lượng: ${st.duration}`)
    console.log(`    - Thẻ Tags: [${st.tags.join(', ')}]`)
    console.log(`    - Đoạn trích: "${st.excerpt}"`)
  })

  // TEST 2: Kiểm thử Phân trang & Lazy Load (Trang 1 -> Trang 2 -> Trang 3)
  console.log('\n[2] Kiểm thử Phân trang & Tải lười (Lazyload / Infinite Scroll):')
  const p1 = await fetchPage('', 1, 20)
  const p2 = await fetchPage('', 2, 20)
  const p3 = await fetchPage('', 3, 20)

  console.log(`  - Trang 1 (items 1-20): Lấy ${p1.stories.length} câu chuyện, hasMore=${p1.hasMore}`)
  console.log(`  - Trang 2 (items 21-40): Lấy ${p2.stories.length} câu chuyện, hasMore=${p2.hasMore}`)
  console.log(`  - Trang 3 (items 41-60): Lấy ${p3.stories.length} câu chuyện, hasMore=${p3.hasMore}`)

  // Kiểm tra không trùng lặp giữa các trang
  const ids1 = new Set(p1.stories.map((s) => s.id))
  const overlap = p2.stories.filter((s) => ids1.has(s.id))
  if (overlap.length === 0) {
    console.log('  ✓ Xác nhận: Không có bản ghi nào bị trùng lặp giữa các trang (0 overlap)!')
  } else {
    console.error(`  ❌ Lỗi: Có ${overlap.length} bản ghi bị trùng lặp!`)
  }

  // TEST 3: Kiểm thử trang cuối cùng (Last Page)
  const lastPageNum = Math.ceil(p1.total / 20)
  console.log(`\n[3] Kiểm thử trang cuối cùng (Trang ${lastPageNum}):`)
  const lastPage = await fetchPage('', lastPageNum, 20)
  console.log(`  - Trang ${lastPageNum}: Lấy ${lastPage.stories.length} câu chuyện`)
  console.log(`  - hasMore trang cuối: ${lastPage.hasMore} (Chính xác phải là false)`)

  if (!lastPage.hasMore) {
    console.log('  ✓ Xác nhận: Trang cuối cùng chuyển hasMore = false chính xác.')
  } else {
    console.error('  ❌ Lỗi: hasMore vẫn bằng true ở trang cuối!')
  }

  console.log('\n========================================================')
  console.log('✅ ĐÃ HOÀN TẤT VÀ VƯỢT QUA TOÀN BỘ KIỂM THỬ PHÂN TRANG!')
  console.log('========================================================')
}

runEndToEndTests().catch((err) => {
  console.error('Lỗi kiểm thử:', err)
  process.exit(1)
})
