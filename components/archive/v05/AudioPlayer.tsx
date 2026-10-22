'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Play, Pause } from 'lucide-react'
import styles from './AudioPlayer.module.css'

interface AudioPlayerProps {
  duration: string
  source: string
  downloadUrl?: string
  playing: boolean
  onTogglePlay: () => void
}

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const h = Math.floor(m / 60)
  if (h > 0) {
    const remM = m % 60
    return `${h}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0
  const parts = durationStr.split(':').map((p) => parseInt(p, 10))
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  }
  return 0
}

export function AudioPlayer({
  duration: fallbackDuration,
  source: _source,
  downloadUrl,
  playing,
  onTogglePlay,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement | null>(null)

  const [currentTime, setCurrentTime] = useState<number>(0)
  const [actualDuration, setActualDuration] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)

  // Sync play / pause prop
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.play().catch(() => {
        // Autoplay policy
      })
    } else {
      audio.pause()
    }
  }, [playing])

  // Reset audio on URL change
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.currentTime = 0
    setCurrentTime(0)
    audio.playbackRate = playbackRate

    if (playing) {
      audio.play().catch(() => {})
    }
  }, [downloadUrl])

  function handleToggleSpeed() {
    const nextSpeed = playbackRate === 1 ? 0.75 : 1
    setPlaybackRate(nextSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const bar = progressRef.current
    const audio = audioRef.current
    if (!bar || !audio) return

    const rect = bar.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const pct = clickX / rect.width
    const totalSec =
      actualDuration > 0 ? actualDuration : parseDuration(fallbackDuration)

    if (totalSec > 0) {
      const newTime = pct * totalSec
      audio.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const effectiveDuration =
    actualDuration > 0 ? actualDuration : parseDuration(fallbackDuration)
  const progressPercent =
    effectiveDuration > 0
      ? Math.min(100, (currentTime / effectiveDuration) * 100)
      : 0

  return (
    <div className={styles.playerContainer}>
      {/* Hidden audio element */}
      {downloadUrl && (
        <audio
          ref={audioRef}
          src={downloadUrl}
          preload="metadata"
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration
            if (!isNaN(d) && d > 0) setActualDuration(d)
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => onTogglePlay()}
        />
      )}

      {/* Play/Pause circular button */}
      <button
        type="button"
        className={styles.playButton}
        onClick={onTogglePlay}
        aria-label={playing ? 'Tạm dừng' : 'Bắt đầu phát audio'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 2 }} />}
      </button>

      {/* Scrubber progress bar */}
      <div
        ref={progressRef}
        className={styles.progressTrack}
        onClick={handleSeek}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={effectiveDuration}
        aria-valuenow={currentTime}
        aria-label="Thanh điều hướng audio"
      >
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        >
          <div className={styles.progressThumb} />
        </div>
      </div>

      {/* Time display: 00:00 / 28:32 */}
      <span className={styles.timeText}>
        {formatTime(currentTime)} / {formatTime(effectiveDuration)}
      </span>

      {/* Speed button: 1x / 0.75x */}
      <button
        type="button"
        className={styles.speedButton}
        onClick={handleToggleSpeed}
        title="Chuyển tốc độ phát 1x / 0.75x"
      >
        {playbackRate}x
      </button>

      {/* Download / Protect AI link */}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          className={styles.downloadLink}
          title="Tải audio về máy"
        >
          <Download size={13} />
          <span>Tải về</span>
        </a>
      )}
    </div>
  )
}

