'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import styles from './VersionSwitcher.module.css'

export type UIVersion = 'v0' | 'v0.5' | 'v1'

interface VersionSwitcherProps {
  version: UIVersion
  onVersionChange: (version: UIVersion) => void
  mounted?: boolean
}

export function VersionSwitcher({
  version,
  onVersionChange,
  mounted = true,
}: VersionSwitcherProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Display version cleanly; when not mounted yet (SSR hydration), show the persisted default without flicker.
  const displayVersion = mounted ? version : 'v1'

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Chọn phiên bản giao diện (v1 / v0.5 / v0)"
        title="Chuyển đổi giao diện"
      >
        <span>{displayVersion}</span>
        <ChevronDown
          size={12}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={displayVersion === 'v1'}
            className={`${styles.item} ${displayVersion === 'v1' ? styles.itemActive : ''}`}
            onClick={() => {
              onVersionChange('v1')
              setOpen(false)
            }}
          >
            <span>v1</span>
            {displayVersion === 'v1' && <Check size={12} />}
          </button>
          <button
            type="button"
            role="option"
            aria-selected={displayVersion === 'v0.5'}
            className={`${styles.item} ${displayVersion === 'v0.5' ? styles.itemActive : ''}`}
            onClick={() => {
              onVersionChange('v0.5')
              setOpen(false)
            }}
          >
            <span>v0.5</span>
            {displayVersion === 'v0.5' && <Check size={12} />}
          </button>
          <button
            type="button"
            role="option"
            aria-selected={displayVersion === 'v0'}
            className={`${styles.item} ${displayVersion === 'v0' ? styles.itemActive : ''}`}
            onClick={() => {
              onVersionChange('v0')
              setOpen(false)
            }}
          >
            <span>v0</span>
            {displayVersion === 'v0' && <Check size={12} />}
          </button>
        </div>
      )}
    </div>
  )
}

