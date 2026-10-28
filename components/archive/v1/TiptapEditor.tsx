'use client'

import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
} from 'lucide-react'
import styles from './TiptapEditor.module.css'

interface TiptapEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  editable?: boolean
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = 'Viết điều bạn muốn giữ lại...',
  editable = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // Synchronize content if modified externally (e.g. switching notes)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '', { emitUpdate: false })
    }
  }, [content, editor])

  if (!editor) {
    return <div className={styles.editorContainer} />
  }

  return (
    <div className={styles.editorContainer}>
      <div className={styles.toolbar}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${styles.toolButton} ${editor.isActive('bold') ? styles.toolButtonActive : ''}`}
          title="In đậm (Ctrl+B)"
          aria-label="In đậm"
        >
          <Bold size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`${styles.toolButton} ${editor.isActive('italic') ? styles.toolButtonActive : ''}`}
          title="In nghiêng (Ctrl+I)"
          aria-label="In nghiêng"
        >
          <Italic size={13} />
        </button>

        <div className={styles.separator} />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`${styles.toolButton} ${editor.isActive('heading', { level: 2 }) ? styles.toolButtonActive : ''}`}
          title="Tiêu đề chính (H2)"
          aria-label="Tiêu đề H2"
        >
          <Heading2 size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${styles.toolButton} ${editor.isActive('heading', { level: 3 }) ? styles.toolButtonActive : ''}`}
          title="Tiêu đề phụ (H3)"
          aria-label="Tiêu đề H3"
        >
          <Heading3 size={13} />
        </button>

        <div className={styles.separator} />

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${styles.toolButton} ${editor.isActive('bulletList') ? styles.toolButtonActive : ''}`}
          title="Danh sách gạch đầu dòng"
          aria-label="Danh sách gạch đầu dòng"
        >
          <List size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${styles.toolButton} ${editor.isActive('orderedList') ? styles.toolButtonActive : ''}`}
          title="Danh sách số"
          aria-label="Danh sách số"
        >
          <ListOrdered size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${styles.toolButton} ${editor.isActive('blockquote') ? styles.toolButtonActive : ''}`}
          title="Trích dẫn"
          aria-label="Trích dẫn"
        >
          <Quote size={13} />
        </button>

        <div className={styles.separator} />

        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className={styles.toolButton}
          title="Hoàn tác (Ctrl+Z)"
          aria-label="Hoàn tác"
          style={{ opacity: editor.can().undo() ? 1 : 0.4 }}
        >
          <Undo size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className={styles.toolButton}
          title="Làm lại (Ctrl+Y)"
          aria-label="Làm lại"
          style={{ opacity: editor.can().redo() ? 1 : 0.4 }}
        >
          <Redo size={13} />
        </button>
      </div>

      <div className={styles.editorBody}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
