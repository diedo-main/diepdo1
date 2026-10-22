import {
  sanitizeHtml,
  hasComplexRichText,
  htmlToCleanPlainText,
  plainTextToHtml,
} from '../lib/notes-format.ts'

console.log('=== RUNNING TESTS FOR NOTES FORMAT & SANITIZATION ===\n')

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`)
    passed++
  } else {
    console.error(`❌ FAIL: ${message}`)
    failed++
  }
}

// 1. Test hasComplexRichText
assert(
  hasComplexRichText('<h2>Tiêu đề</h2><p>Nội dung</p>') === true,
  'Detects H2 heading as complex rich text'
)
assert(
  hasComplexRichText('<p>Đây là <strong>in đậm</strong></p>') === true,
  'Detects strong/bold as complex rich text'
)
assert(
  hasComplexRichText('<ul><li>Ý 1</li><li>Ý 2</li></ul>') === true,
  'Detects list as complex rich text'
)
assert(
  hasComplexRichText('<blockquote>Trích dẫn một câu</blockquote>') === true,
  'Detects blockquote as complex rich text'
)
assert(
  hasComplexRichText('<p>Văn bản đơn giản không có format phức tạp</p>') === false,
  'Simple paragraph is not treated as complex rich text'
)
assert(
  hasComplexRichText('Văn bản thuần túy') === false,
  'Plain text is not complex rich text'
)

// 2. Test htmlToCleanPlainText
const sampleHtml = '<h2>Tiêu đề bài học</h2><p>Đoạn 1 với <strong>in đậm</strong> và <em>nghiêng</em>.</p><ul><li>Ý gạch đầu dòng 1</li><li>Ý gạch đầu dòng 2</li></ul><blockquote>Lời nhắn nhủ</blockquote>'
const cleanText = htmlToCleanPlainText(sampleHtml)

assert(!cleanText.includes('<'), 'Clean plain text contains NO "<"')
assert(cleanText.includes('Tiêu đề bài học'), 'Preserves heading text')
assert(cleanText.includes('in đậm'), 'Preserves bold text')
assert(cleanText.includes('• Ý gạch đầu dòng 1'), 'Preserves bullet points with •')
assert(cleanText.includes('Lời nhắn nhủ'), 'Preserves quote text')

// 3. Test plainTextToHtml
const samplePlain = 'Đoạn văn 1.\n\nĐoạn văn 2 có dòng 1\nvà dòng 2.'
const convertedHtml = plainTextToHtml(samplePlain)
assert(convertedHtml.startsWith('<p>'), 'Plain text converted to HTML starts with <p>')
assert(convertedHtml.includes('<p>Đoạn văn 1.</p>'), 'Wraps first paragraph')
assert(convertedHtml.includes('<br />'), 'Converts single newline to <br />')

// 4. Test sanitizeHtml
const dangerousHtml = '<p>An toàn</p><script>alert("xss")</script><img src="x" onerror="alert(1)" /><a href="javascript:void(0)">Link xấu</a>'
const sanitized = sanitizeHtml(dangerousHtml)
assert(!sanitized.includes('<script>'), 'Strips <script> tags')
assert(!sanitized.includes('onerror='), 'Strips onerror attribute')
assert(!sanitized.includes('javascript:'), 'Strips javascript: URL')
assert(sanitized.includes('<p>An toàn</p>'), 'Preserves safe tags')

console.log(`\n========================================`)
console.log(`RESULTS: ${passed} passed, ${failed} failed`)
console.log(`========================================`)

if (failed > 0) process.exit(1)

