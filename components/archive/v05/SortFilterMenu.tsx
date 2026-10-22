'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowUpDown, SlidersHorizontal, Check, ChevronDown } from 'lucide-react'
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
  { field: 'title', label: 'Tiêu đề' },
  { field: 'extracted_sender', label: 'Người gửi' },
  { field: 'duration_seconds', label: 'Thời lượng' },
  { field: 'content_status', label: 'Trạng thái nội dung' },
  { field: 'source', label: 'Nguồn' },
  { field: 'id', label: 'ID' },
]

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'full', label: 'Bản đầy đủ' },
  { value: 'external', label: 'Google Docs' },
  { value: 'missing', label: 'Audio' },
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
  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const sortRef = useRef<HTMLDivElement | null>(null)
  const filterRef = useRef<HTMLDivElement | null>(null)

  // Click outside and Escape key listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSortOpen(false)
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* 1. SẮP XẾP POPOVER */}
      <div className={styles.menuContainer} ref={sortRef}>
        <button
          type="button"
          className={`${styles.triggerButton} ${sortOpen ? styles.triggerButtonActive : ''}`}
          onClick={() => {
            setSortOpen(!sortOpen)
            setFilterOpen(false)
          }}
          aria-haspopup="true"
          aria-expanded={sortOpen}
        >
          <ArrowUpDown size={12} />
          <span>Sắp xếp</span>
          <ChevronDown size={11} className={styles.chevron} />
        </button>

        {sortOpen && (
          <div className={styles.popover} role="menu">
            <h3 className={styles.popoverHeader}>Sắp xếp theo</h3>

            <div className={styles.optionsList}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = sortBy === opt.field
                return (
                  <div
                    key={opt.field}
                    className={styles.radioOption}
                    onClick={() => {
                      onSortChange(opt.field, sortOrder)
                    }}
                  >
                    <div
                      className={`${styles.radioCircle} ${
                        isSelected ? styles.radioCircleChecked : ''
                      }`}
                    >
                      {isSelected && <div className={styles.radioInner} />}
                    </div>
                    <span>{opt.label}</span>
                  </div>
                )
              })}
            </div>

            <div className={styles.directionButtons}>
              <button
                type="button"
                className={`${styles.dirBtn} ${
                  sortOrder === 'asc' ? styles.dirBtnActive : ''
                }`}
                onClick={() => onSortChange(sortBy, 'asc')}
              >
                Tăng dần
              </button>
              <button
                type="button"
                className={`${styles.dirBtn} ${
                  sortOrder === 'desc' ? styles.dirBtnActive : ''
                }`}
                onClick={() => onSortChange(sortBy, 'desc')}
              >
                Giảm dần
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. BỘ LỌC POPOVER */}
      <div className={styles.menuContainer} ref={filterRef}>
        <button
          type="button"
          className={`${styles.triggerButton} ${filterOpen ? styles.triggerButtonActive : ''}`}
          onClick={() => {
            setFilterOpen(!filterOpen)
            setSortOpen(false)
          }}
          aria-haspopup="true"
          aria-expanded={filterOpen}
        >
          <SlidersHorizontal size={12} />
          <span>Bộ lọc</span>
          <ChevronDown size={11} className={styles.chevron} />
        </button>

        {filterOpen && (
          <div className={styles.popover} role="menu">
            <h3 className={styles.popoverHeader}>Lọc theo loại nội dung</h3>

            <div className={styles.optionsList}>
              {STATUS_OPTIONS.map((opt) => {
                const isChecked = contentStatus === opt.value
                return (
                  <div
                    key={opt.value}
                    className={styles.radioOption}
                    onClick={() => onStatusChange(opt.value)}
                  >
                    <div
                      className={`${styles.checkboxSquare} ${
                        isChecked ? styles.checkboxSquareChecked : ''
                      }`}
                    >
                      {isChecked && <Check size={10} />}
                    </div>
                    <span>{opt.label}</span>
                  </div>
                )
              })}
            </div>

            <div style={{ paddingTop: 8, borderTop: '1px solid #2f3029' }}>
              <div
                className={styles.radioOption}
                onClick={() => {
                  onHasNotesChange(hasNotesFilter ? null : true)
                }}
              >
                <div
                  className={`${styles.checkboxSquare} ${
                    hasNotesFilter ? styles.checkboxSquareChecked : ''
                  }`}
                >
                  {hasNotesFilter && <Check size={10} />}
                </div>
                <span>Có ghi chú cá nhân</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

