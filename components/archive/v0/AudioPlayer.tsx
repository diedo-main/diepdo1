'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Play, Pause } from 'lucide-react'

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

export function AudioPlayer({
  duration: fallbackDuration,
  source,
  downloadUrl,
  playing,
  onTogglePlay,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement | null>(null)

  const [currentTime, setCurrentTime] = useState<number>(0)
  const [actualDuration, setActualDuration] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState<boolean>(false)

  // Speed options requested by user: 0.75 and 1 (with 1.25 optional)
  const SPEED_OPTIONS = [0.75, 1, 1.25]

  // Synchronize play / pause with prop
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.play().catch(() => {
        // Autoplay may be restricted by browser until user gesture
      })
    } else {
      audio.pause()
    }
  }, [playing])

  // Reset audio when source URL changes
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

  // Handle playback speed change
  function handleSetSpeed(newSpeed: number) {
    setPlaybackRate(newSpeed)
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed
    }
    setShowSpeedMenu(false)
  }

  // Toggle speed between 1x and 0.75x quickly when clicked directly
  function handleCycleSpeed() {
    // If currently 1, switch to 0.75; if 0.75, switch to 1; otherwise cycle
    const nextSpeed = playbackRate === 1 ? 0.75 : 1
    handleSetSpeed(nextSpeed)
  }

  // Seek on progress bar click
  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const bar = progressRef.current
    const audio = audioRef.current
    if (!bar || !audio) return

    const rect = bar.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const pct = clickX / rect.width
    const totalSec = actualDuration > 0 ? actualDuration : parseDuration(fallbackDuration)

    if (totalSec > 0) {
      const newTime = pct * totalSec
      audio.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  function parseDuration(durStr: string): number {
    if (!durStr) return 0
    const parts = durStr.split(':').map(Number)
    if (parts.length === 2) return parts[0] * 60 + parts[1]
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return 0
  }

  const totalSeconds = actualDuration > 0 ? actualDuration : parseDuration(fallbackDuration)
  const progressPercent = totalSeconds > 0 ? Math.min(100, (currentTime / totalSeconds) * 100) : 0
  const displayDuration = actualDuration > 0 ? formatTime(actualDuration) : fallbackDuration || '00:00'

  return (
    <div className="player" style={{ position: 'relative' }}>
      {/* Hidden real HTML5 Audio element */}
      {downloadUrl && (
        <audio
          ref={audioRef}
          src={downloadUrl}
          preload="metadata"
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime)
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setActualDuration(audioRef.current.duration)
              audioRef.current.playbackRate = playbackRate
            }
          }}
          onEnded={() => {
            if (playing) onTogglePlay()
          }}
        />
      )}

      {/* Play/Pause Button */}
      <button
        type="button"
        className="play-button"
        onClick={onTogglePlay}
        aria-label={playing ? 'Tạm dừng' : 'Phát'}
      >
        {playing ? <Pause fill="currentColor" size={13} /> : <Play fill="currentColor" size={13} />}
      </button>

      {/* Seekable Progress Bar */}
      <div
        ref={progressRef}
        className="progress"
        onClick={handleSeek}
        style={{ cursor: 'pointer' }}
        title="Nhấn để tua đến thời điểm này"
      >
        <span style={{ width: `${progressPercent}%`, transition: 'width 0.1s linear' }} />
      </div>

      {/* Time Display */}
      <small style={{ minWidth: 70, fontVariantNumeric: 'tabular-nums' }}>
        {formatTime(currentTime)} / {displayDuration}
      </small>

      {/* Playback Speed Control (0.75x & 1x) */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleCycleSpeed}
          onContextMenu={(e) => {
            e.preventDefault()
            setShowSpeedMenu(!showSpeedMenu)
          }}
          title={`Tốc độ phát: ${playbackRate}x (Nhấn để chuyển 1x / 0.75x)`}
          style={{
            border: playbackRate !== 1 ? '1px solid var(--olive)' : '1px solid #3c3d38',
            borderRadius: 6,
            background: playbackRate !== 1 ? 'rgba(179, 199, 133, 0.15)' : '#272824',
            color: playbackRate !== 1 ? 'var(--olive)' : '#dddcd5',
            padding: '2px 7px',
            fontSize: '10px',
            fontWeight: 600,
            cursor: 'pointer',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {playbackRate}x
        </button>

        {/* Speed Selector Dropdown */}
        {showSpeedMenu && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 6,
              background: '#1d1e1b',
              border: '1px solid #3c3d38',
              borderRadius: 6,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            {SPEED_OPTIONS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => handleSetSpeed(rate)}
                style={{
                  border: 0,
                  background: playbackRate === rate ? 'var(--olive)' : 'transparent',
                  color: playbackRate === rate ? '#181917' : '#eee',
                  padding: '3px 9px',
                  borderRadius: 4,
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {rate}x {rate === 1 ? '(Chuẩn)' : rate === 0.75 ? '(Chậm)' : ''}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className="player-icon" style={{ cursor: 'default' }}>
        ◖
      </span>

      {/* Download MP3 URL */}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Tải xuống tệp MP3"
          title="Tải xuống tệp MP3"
        >
          <Download size={14} />
        </a>
      )}

      {/* Source label */}
      <span className="source">{source}</span>
    </div>
  )
}
