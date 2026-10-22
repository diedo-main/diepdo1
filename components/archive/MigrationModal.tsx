'use client'

import { useState } from 'react'
import { ShieldCheck, CloudUpload, X } from 'lucide-react'
import styles from './MigrationModal.module.css'

interface MigrationModalProps {
  isOpen: boolean
  onClose: () => void
  legacyNote: string
  legacyTags: string[]
  onConfirmMigration: () => Promise<void>
}

export function MigrationModal({
  isOpen,
  onClose,
  legacyNote,
  legacyTags,
  onConfirmMigration,
}: MigrationModalProps) {
  const [migrating, setMigrating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setMigrating(true)
    setError(null)
    try {
      // 1. Create automatic permanent backup in localStorage before syncing
      const backupKey = `life-archive-backup-legacy-${Date.now()}`
      localStorage.setItem(
        backupKey,
        JSON.stringify({
          note: legacyNote,
          tags: legacyTags,
          backedUpAt: new Date().toISOString(),
        })
      )

      // 2. Perform server migration
      await onConfirmMigration()

      // 3. Mark as successfully migrated
      localStorage.setItem('life-archive-migrated-v05', 'true')
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi đồng bộ dữ liệu.'
      setError(msg)
    } finally {
      setMigrating(false)
    }
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <h2 className={styles.title}>Đồng bộ Ghi chú & Thẻ lên Đám mây</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Đóng modal"
          >
            <X size={16} />
          </button>
        </div>

        <p className={styles.description}>
          Phát hiện dữ liệu ghi chú và thẻ cũ đang lưu trữ cục bộ trên trình duyệt của bạn. Bạn có muốn đồng bộ an toàn lên kho lưu trữ Supabase để bảo vệ vĩnh viễn không?
        </p>

        {/* Reconciliation Preview Box */}
        <div className={styles.previewBox}>
          {legacyNote && (
            <div>
              <span className={styles.previewHeading}>Nội dung ghi chú phát hiện:</span>
              <p className={styles.previewText}>{legacyNote}</p>
            </div>
          )}

          {legacyTags.length > 0 && (
            <div>
              <span className={styles.previewHeading}>Thẻ tùy biến ({legacyTags.length}):</span>
              <div className={styles.tagPills}>
                {legacyTags.map((tag) => (
                  <span key={tag} className={styles.tagPill}>
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className={styles.backupNotice}>
          <ShieldCheck size={14} style={{ color: 'var(--olive)', flexShrink: 0 }} />
          <span>Hệ thống sẽ tự động tạo bản sao lưu an toàn trước khi di chuyển.</span>
        </div>

        {error && (
          <p style={{ color: '#e07a5f', fontSize: '11.5px', margin: 0 }}>
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.dismissButton}
            onClick={onClose}
            disabled={migrating}
          >
            Để sau
          </button>

          <button
            type="button"
            className={styles.confirmButton}
            onClick={handleConfirm}
            disabled={migrating}
          >
            <CloudUpload size={14} />
            <span>{migrating ? 'Đang đồng bộ...' : 'Sao lưu & Đồng bộ ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

