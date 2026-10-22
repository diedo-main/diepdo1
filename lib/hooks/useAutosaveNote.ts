'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { NoteRecord } from '@/types'
import { plainTextToHtml } from '@/lib/notes-format'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutosaveNoteOptions {
  storyId: string
  activeNoteId: number | null
  initialContent: string
  onSaveSuccess?: (updatedNote: NoteRecord) => void
  onSaveError?: (error: Error) => void
}

export function useAutosaveNote({
  storyId,
  activeNoteId,
  initialContent,
  onSaveSuccess,
  onSaveError,
}: UseAutosaveNoteOptions) {
  const [content, setContent] = useState<string>(initialContent)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [lastSavedTime, setLastSavedTime] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Tracking refs to prevent race conditions & out-of-order responses
  const currentSeqRef = useRef<number>(0)
  const lastProcessedSeqRef = useRef<number>(0)
  const abortCtrlRef = useRef<AbortController | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Stable references to latest values
  const latestContentRef = useRef<string>(initialContent)
  const storyIdRef = useRef<string>(storyId)
  const activeNoteIdRef = useRef<number | null>(activeNoteId)

  // Sync state when story or active note changes
  useEffect(() => {
    setContent(initialContent)
    latestContentRef.current = initialContent
    storyIdRef.current = storyId
    activeNoteIdRef.current = activeNoteId
    setSaveStatus('idle')
    setErrorMessage(null)

    // Check if there is an unsaved draft from network failure
    const draftKey = `draft_note_${storyId}_${activeNoteId || 'new'}`
    const savedDraft = localStorage.getItem(draftKey)
    if (savedDraft && savedDraft !== initialContent) {
      setContent(savedDraft)
      latestContentRef.current = savedDraft
      setSaveStatus('saved')
    }
  }, [storyId, activeNoteId, initialContent])

  // Core save executor with sequence numbering and AbortController
  const executeSave = useCallback(
    async (contentToSave: string, sId: string, nId: number | null) => {
      if (!sId) return

      // Abort any currently in-flight save request
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort()
      }
      abortCtrlRef.current = new AbortController()

      const thisSeq = ++currentSeqRef.current
      setSaveStatus('saving')
      setErrorMessage(null)

      try {
        const payload = {
          content: plainTextToHtml(contentToSave),
          title: 'Bài học',
        }

        let res: Response
        if (nId) {
          // Update existing note
          res = await fetch(
            `/api/stories/${encodeURIComponent(sId)}/notes/${nId}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              signal: abortCtrlRef.current.signal,
            }
          )
        } else {
          // Create new note
          res = await fetch(`/api/stories/${encodeURIComponent(sId)}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: abortCtrlRef.current.signal,
          })
        }

        // Out-of-order check: if a newer request already fired, discard this older response
        if (thisSeq < lastProcessedSeqRef.current) {
          return
        }
        lastProcessedSeqRef.current = thisSeq

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Lỗi khi lưu ghi chú lên máy chủ.')
        }

        const data = await res.json()
        const now = new Date()
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        setSaveStatus('saved')
        setLastSavedTime(timeStr)

        // Clear backup draft on successful save
        const draftKey = `draft_note_${sId}_${nId || 'new'}`
        localStorage.removeItem(draftKey)

        if (onSaveSuccess && data.note) {
          activeNoteIdRef.current = data.note.id
          onSaveSuccess(data.note)
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Normal abort when new save was scheduled
          return
        }

        // Save failed: protect draft in localStorage
        const draftKey = `draft_note_${sId}_${nId || 'new'}`
        localStorage.setItem(draftKey, contentToSave)

        const error = err instanceof Error ? err : new Error('Lỗi kết nối')
        setSaveStatus('error')
        setErrorMessage(error.message)
        if (onSaveError) onSaveError(error)
      }
    },
    [onSaveSuccess, onSaveError]
  )

  // Schedule autosave with 800ms debounce
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent)
      latestContentRef.current = newContent

      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }

      setSaveStatus('saving')
      timerRef.current = setTimeout(() => {
        executeSave(
          latestContentRef.current,
          storyIdRef.current,
          activeNoteIdRef.current
        )
      }, 800)
    },
    [executeSave]
  )

  // Flush pending changes immediately (e.g. before closing panel or switching story)
  const flushSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (latestContentRef.current !== initialContent) {
      executeSave(
        latestContentRef.current,
        storyIdRef.current,
        activeNoteIdRef.current
      )
    }
  }, [executeSave, initialContent])

  // Cleanup on unmount: flush pending save
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    content,
    saveStatus,
    lastSavedTime,
    errorMessage,
    handleContentChange,
    flushSave,
    retrySave: () =>
      executeSave(
        latestContentRef.current,
        storyIdRef.current,
        activeNoteIdRef.current
      ),
  }
}

