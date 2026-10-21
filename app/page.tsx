'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Download, Headphones, MoreHorizontal, Play, Plus, Search, Tag, Trash2, X } from 'lucide-react'

type Story = {
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
}

const stories: Story[] = [
  { id: 'listening', date: '12 thg 10, 2026', title: 'Có những ngày mình chỉ cần được lắng nghe', excerpt: 'Mình đã từng nghĩ phải tự giải quyết mọi thứ. Nhưng có một giai đoạn, điều mình cần nhất chỉ là một người ngồi cạnh...', tags: ['Chữa lành', 'Gia đình'], image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=600&q=80', duration: '37:18', source: 'Podcast Anh 5', confession: ['Có một thời gian mình rất sợ phải nói ra điều mình đang chịu đựng. Mình sợ làm phiền người khác, sợ bị đánh giá là yếu đuối, nên cứ cố tỏ ra bình thường.', 'Nhưng càng cố gắng, mình càng thấy mệt. Có những ngày, cảm xúc cứ dồn lại, dù không có chuyện gì quá lớn, nhưng mình vẫn thấy trống rỗng. Mình nhận ra, điều mình cần nhất chỉ là một người ngồi cạnh và lắng nghe. Không cần đưa ra lời khuyên, không cần giải pháp, chỉ cần hiện diện thôi.', 'Và thật kỳ lạ, đôi khi chỉ cần được lắng nghe, mọi thứ đã nhẹ đi rất nhiều.'], transcript: 'Anh 5: Có những lúc, điều cứu chúng ta không phải là một lời khuyên đúng, mà là cảm giác rằng mình không đơn độc trong những gì mình đang trải qua.' },
  { id: 'work', date: '04 thg 10, 2026', title: 'Bài học sau lần rời bỏ một công việc tốt', excerpt: 'Không phải điều gì ổn định cũng là điều phù hợp. Mình mất khá lâu để chấp nhận điều đó...', tags: ['Công việc', 'Trưởng thành'], image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=600&q=80', duration: '21:04', source: 'Ghi âm cá nhân', confession: ['Mình đã nghĩ một công việc tốt phải là một công việc khiến ai cũng ngưỡng mộ. Nhưng rồi mình hiểu, sự ổn định không thể thay thế cảm giác được sống đúng với mình.'], transcript: 'Có những lựa chọn nhìn từ bên ngoài thật khó hiểu, nhưng lại là điều cần thiết để mình bước tiếp.' },
  { id: 'father', date: '17 thg 09, 2026', title: 'Lần đầu mình nói thật với bố', excerpt: 'Cuộc trò chuyện chỉ kéo dài mười phút, nhưng mình đã chuẩn bị cho nó gần mười năm...', tags: ['Gia đình'], image: 'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=600&q=80', duration: '14:22', source: 'Ghi âm cá nhân', confession: ['Có những điều mình giấu rất lâu vì sợ người thân thất vọng. Nhưng đôi khi thành thật không phải để thay đổi ai, mà để mình được nhẹ lòng.'], transcript: 'Mình đã bước vào cuộc trò chuyện ấy với rất nhiều sợ hãi, và bước ra với một sự bình yên mà mình không ngờ tới.' },
]

export default function Page() {
  const [view, setView] = useState<'home' | 'search' | 'reading'>('home')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Story | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [note, setNote] = useState('')
  const [savedNote, setSavedNote] = useState('')
  const [customTags, setCustomTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState('')
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setSavedNote(localStorage.getItem('life-archive-note') || '')
    setCustomTags(JSON.parse(localStorage.getItem('life-archive-tags') || '[]'))
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return stories
    return stories.filter((story) => `${story.title} ${story.excerpt} ${story.tags.join(' ')}`.toLowerCase().includes(q))
  }, [query])

  function search(value = query) {
    setQuery(value)
    setView('search')
  }
  function openStory(story: Story) {
    setSelected(story)
    setNotesOpen(false)
    setPlaying(false)
    setView('reading')
  }
  function saveNote() {
    localStorage.setItem('life-archive-note', note)
    setSavedNote(note)
  }
  function addTag() {
    const tag = newTag.trim()
    if (!tag || customTags.includes(tag)) return
    const next = [...customTags, tag]
    setCustomTags(next)
    localStorage.setItem('life-archive-tags', JSON.stringify(next))
    setNewTag('')
  }
  function removeTag(tag: string) {
    const next = customTags.filter((item) => item !== tag)
    setCustomTags(next)
    localStorage.setItem('life-archive-tags', JSON.stringify(next))
  }

  return <main className="archive-shell">
    <header className="topbar">
      <button className="wordmark" onClick={() => { setView('home'); setSelected(null); setNotesOpen(false) }}>Life <span>Archive</span></button>
    </header>
    {view === 'home' && <section className="home-view">
      <form className="search-box home-search" onSubmit={(e) => { e.preventDefault(); search() }}><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm lại một câu chuyện, từ khóa hoặc thẻ..." aria-label="Tìm kiếm" /></form>
      <p className="search-hint">Tìm trong confession, transcript và ghi chú cá nhân</p>
    </section>}
    {view === 'search' && <section className="search-view">
      <form className="search-box results-search" onSubmit={(e) => { e.preventDefault(); search() }}><Search /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm kiếm" aria-label="Tìm kiếm" />{query && <button type="button" className="clear-button" onClick={() => setQuery('')} aria-label="Xóa tìm kiếm"><X /></button>}</form>
      <div className="results-heading"><h2>Kết quả tìm kiếm</h2><span>{results.length} câu chuyện</span></div>
      <div className="results-list">{results.map((story, index) => <button className={`result-card ${index === 0 ? 'active' : ''}`} key={story.id} onClick={() => openStory(story)}><img src={story.image} alt="" /><span className="result-copy"><small>{story.date}</small><strong>{story.title}</strong><span>{story.excerpt}</span><span className="tags">{story.tags.map(tag => <em key={tag}>{tag}</em>)}</span></span><span className="podcast-label">{index === 0 && <Headphones />} {index === 0 ? 'Có podcast' : ''}</span></button>)}</div>
    </section>}
    {view === 'reading' && selected && <section className={`reading-view ${notesOpen ? 'with-notes' : ''}`}>
      <article className="story-content"><button className="back-link" onClick={() => setView('search')}><ArrowLeft /> Kết quả tìm kiếm</button><div className="story-heading"><small>{selected.date}</small><h1>{selected.title}</h1><div className="tags">{selected.tags.map(tag => <em key={tag}>{tag}</em>)}</div></div>
        <button className="icon-button story-menu" aria-label="Mở menu"><MoreHorizontal /></button>
        <div className="player"><button className="play-button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Tạm dừng' : 'Phát'}>{playing ? <span className="pause-bars">||</span> : <Play fill="currentColor" />}</button><div className="progress"><span style={{ width: playing ? '48%' : '32%' }} /></div><small>14:32 / {selected.duration}</small><span className="player-icon">◖</span><a href={selected.image} download aria-label="Tải xuống"><Download /></a><span className="source">{selected.source}</span></div>
        <div className="story-text"><h3>Confession gốc</h3>{selected.confession.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="transcript"><h3>Transcript</h3><p>{selected.transcript}</p></div></div>
      </article>
      <button className="notes-trigger" onClick={() => setNotesOpen(true)}>Ghi chú & thẻ</button>
      {notesOpen && <aside className="notes-panel"><div className="notes-header"><div><h2>Ghi chú & thẻ</h2><p>Cho câu chuyện này</p></div><button className="close-notes" onClick={() => setNotesOpen(false)} aria-label="Đóng ghi chú"><X /></button></div><div className="note-section"><h3>Thẻ</h3><div className="tags">{selected.tags.map(tag => <em key={tag}>{tag}</em>)}{customTags.map(tag => <em className="custom-tag" key={tag}>{tag}<button onClick={() => removeTag(tag)} aria-label={`Xóa thẻ ${tag}`}><X /></button></em>)}<button className="add-tag" onClick={() => document.getElementById('tag-input')?.focus()}><Plus /> Thêm thẻ</button></div><div className="tag-entry"><Tag /><input id="tag-input" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="Thẻ mới" /><button onClick={addTag}>Thêm</button></div></div><div className="note-section personal"><h3>Ghi chú cá nhân</h3><textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Viết điều bạn muốn giữ lại..." /><button className="save-note" onClick={saveNote}><Check /> Lưu ghi chú</button>{savedNote && <div className="saved-note"><div><strong>Bài học</strong><button onClick={() => { setNote(''); setSavedNote(''); localStorage.removeItem('life-archive-note') }} aria-label="Xóa ghi chú"><Trash2 /></button></div><p>{savedNote}</p></div>}</div></aside>}
    </section>}
    {view === 'reading' && !notesOpen && <button className="floating-notes" onClick={() => setNotesOpen(true)}>Ghi chú & thẻ</button>}
  </main>
}
