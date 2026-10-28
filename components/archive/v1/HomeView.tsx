'use client'

import { Search } from 'lucide-react'
import styles from './HomeView.module.css'

interface HomeViewProps {
  onOpenSearch: () => void
}

export function HomeView({ onOpenSearch }: HomeViewProps) {
  return (
    <section className={styles.homeView}>
      <h1 className={styles.wordmark}>
        Life <span>Archive</span>
      </h1>

      <button
        type="button"
        className={styles.searchButton}
        onClick={onOpenSearch}
        aria-label="Tìm trong kho lưu trữ"
      >
        <Search aria-hidden="true" size={18} strokeWidth={1.75} />
        <span>Tìm trong kho lưu trữ</span>
      </button>
    </section>
  )
}
