'use client'

import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal, Check, ArrowUp, ArrowDown } from 'lucide-react'
import { SortField, SortOrder } from '@/types'
import styles from './SortFilterMenu.module.css'

interface SortFilterMenuProps {
  sortBy: SortField
  sortOrder: SortOrder
  onSortChange: (field: SortField, order: SortOrder) => void
  contentStatus: string
  onStatusChange: (status: string) => void
  hasNotesFilter: boolean | null
  onHasNotesChange: (hasNotes: boolean | null) => void
}

const SORT_OPTIONS: Array<{ field: SortField; label: string }> = [
  { field: 'pub_date', label: 'Ngày đăng' },
  { field: 'id', label: 'ID câu chuyện' },
  { field: 'title', label: 'Tiêu đề' },
  { field: 'extracted_sender', label: 'Người gửi' },
  { field: 'duration_seconds', label: 'Thời lượng' },
]

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Tất cả trạng thái' },
  { value: 'full', label: 'Bản đầy đủ' },
  { value: 'external', label: 'Google Docs' },
]

export function SortFilterMenu({
  sortBy,
  sortOrder,
  onSortChange,
  contentStatus,
  onStatusChange,
  hasNotesFilter,
  onHasNotesChange,
}: SortFilterMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const hasActiveFilters =
    contentStatus !== 'all' ||
    hasNotesFilter !== null ||
    sortBy !== 'pub_date' ||
    sortOrder !== 'desc'

  return (
    <div className={styles.container} ref={menuRef}>
      <div className={styles.menuWrapper}>
        <button
          type="button"
          className={`${styles.filterButton} ${open ? styles.filterButtonActive : ''}`}
          onClick={() => setOpen(!open)}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label="Lọc và sắp xếp kết quả"
        >
          <SlidersHorizontal size={14} />
          <span>Lọc lại</span>
          {hasActiveFilters && <span className={styles.badge} />}
        </button>

        {open && (
          <div className={styles.dropdown} role="dialog" aria-label="Tùy chọn lọc & sắp xếp">
            {/* Sắp xếp theo trường */}
            <div>
              <div className={styles.sectionTitle}>Sắp xếp theo</div>
              <div className={styles.optionsList}>
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.field}
                    type="button"
                    className={`${styles.optionItem} ${sortBy === opt.field ? styles.optionItemActive : ''}`}
                    onClick={() => {
                      onSortChange(opt.field, sortOrder)
                    }}
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.field && <Check size={13} />}
                  </button>
                ))}
              </div>

              {/* Thứ tự tăng / giảm */}
              <div className={styles.directionRow}>
                <button
                  type="button"
                  className={`${styles.directionBtn} ${sortOrder === 'asc' ? styles.directionBtnActive : ''}`}
                  onClick={() => onSortChange(sortBy, 'asc')}
                  aria-label="Sắp xếp tăng dần"
                >
                  <ArrowUp size={12} />
                  <span>Tăng dần</span>
                </button>
                <button
                  type="button"
                  className={`${styles.directionBtn} ${sortOrder === 'desc' ? styles.directionBtnActive : ''}`}
                  onClick={() => onSortChange(sortBy, 'desc')}
                  aria-label="Sắp xếp giảm dần"
                >
                  <ArrowDown size={12} />
                  <span>Giảm dần</span>
                </button>
              </div>
            </div>

            <div className={styles.divider} />

            {/* Nội dung */}
            <div>
              <div className={styles.sectionTitle}>Nội dung</div>
              <div className={styles.optionsList}>
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`${styles.optionItem} ${contentStatus === opt.value ? styles.optionItemActive : ''}`}
                    onClick={() => onStatusChange(opt.value)}
                  >
                    <span>{opt.label}</span>
                    {contentStatus === opt.value && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.divider} />

            {/* Ghi chú */}
            <div>
              <div className={styles.sectionTitle}>Ghi chú cá nhân</div>
              <div className={styles.optionsList}>
                <button
                  type="button"
                  className={`${styles.optionItem} ${hasNotesFilter === null ? styles.optionItemActive : ''}`}
                  onClick={() => onHasNotesChange(null)}
                >
                  <span>Tất cả</span>
                  {hasNotesFilter === null && <Check size={13} />}
                </button>
                <button
                  type="button"
                  className={`${styles.optionItem} ${hasNotesFilter === true ? styles.optionItemActive : ''}`}
                  onClick={() => onHasNotesChange(true)}
                >
                  <span>Đã có ghi chú</span>
                  {hasNotesFilter === true && <Check size={13} />}
                </button>
                <button
                  type="button"
                  className={`${styles.optionItem} ${hasNotesFilter === false ? styles.optionItemActive : ''}`}
                  onClick={() => onHasNotesChange(false)}
                >
                  <span>Chưa có ghi chú</span>
                  {hasNotesFilter === false && <Check size={13} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
