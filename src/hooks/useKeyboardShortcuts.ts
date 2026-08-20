import { useEffect } from 'react'
import { applyFitZoom } from '@/lib/zoom'
import { useDocumentStore } from '@/store/documentStore'
import { useToastStore } from '@/store/toastStore'
import type { Tool } from '@/types'

const TOOL_BY_KEY: Record<string, Tool> = {
  v: 'select',
  e: 'editText',
  h: 'highlight',
  u: 'underline',
  d: 'draw',
  t: 'text',
  n: 'sticky',
  i: 'image',
  k: 'signature',
  f: 'form',
}

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function goToPage(index: number) {
  const { pages, setCurrentPage } = useDocumentStore.getState()
  if (pages.length === 0) return
  const next = Math.min(Math.max(0, index), pages.length - 1)
  setCurrentPage(next)
  document.getElementById(`page-${pages[next].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

type Options = {
  helpOpen: boolean
  toggleHelp: () => void
  closeHelp: () => void
}

export function useKeyboardShortcuts({ helpOpen, toggleHelp, closeHelp }: Options) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target)
      const mod = e.ctrlKey || e.metaKey
      const key = e.key
      const lower = key.toLowerCase()

      if (key === 'Escape') {
        if (helpOpen) {
          e.preventDefault()
          closeHelp()
          return
        }
        if (typing) return
        e.preventDefault()
        const { setTool, setSelectedAnnotation, setSignatureOpen, pendingImage, setPendingImage } =
          useDocumentStore.getState()
        setSignatureOpen(false)
        if (pendingImage) setPendingImage(null)
        setSelectedAnnotation(null)
        setTool('select')
        return
      }

      if (!typing && !mod && (key === '?' || (e.shiftKey && key === '/'))) {
        e.preventDefault()
        toggleHelp()
        return
      }

      if (helpOpen) return
      if (typing && !(mod && lower === 's')) return

      if (mod && (key === '+' || key === '=' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault()
        const { zoom, setZoom } = useDocumentStore.getState()
        setZoom(zoom + 0.1)
        return
      }
      if (mod && (key === '-' || key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault()
        const { zoom, setZoom } = useDocumentStore.getState()
        setZoom(zoom - 0.1)
        return
      }
      if (mod && (key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault()
        applyFitZoom('actual')
        return
      }
      if (mod && (key === '1' || e.code === 'Digit1' || e.code === 'Numpad1')) {
        e.preventDefault()
        applyFitZoom('fitPage')
        return
      }
      if (mod && (key === '2' || e.code === 'Digit2' || e.code === 'Numpad2')) {
        e.preventDefault()
        applyFitZoom('fitWidth')
        return
      }

      if (mod && lower === 'z') {
        e.preventDefault()
        const { undo, redo } = useDocumentStore.getState()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && lower === 'y') {
        e.preventDefault()
        useDocumentStore.getState().redo()
        return
      }
      if (mod && lower === 's') {
        e.preventDefault()
        const { pages, download } = useDocumentStore.getState()
        if (pages.length) void download()
        return
      }
      if (mod && lower === 'o') {
        e.preventDefault()
        document.getElementById('open-pdf-input')?.click()
        return
      }

      if (mod || e.altKey) return

      if (key === 'Delete' || key === 'Backspace') {
        const { selectedAnnotationId, removeAnnotation } = useDocumentStore.getState()
        if (!selectedAnnotationId) return
        e.preventDefault()
        removeAnnotation(selectedAnnotationId)
        return
      }

      if (key === 'PageDown') {
        e.preventDefault()
        const { currentPageIndex } = useDocumentStore.getState()
        goToPage(currentPageIndex + 1)
        return
      }
      if (key === 'PageUp') {
        e.preventDefault()
        const { currentPageIndex } = useDocumentStore.getState()
        goToPage(currentPageIndex - 1)
        return
      }
      if (key === 'Home') {
        e.preventDefault()
        goToPage(0)
        return
      }
      if (key === 'End') {
        e.preventDefault()
        goToPage(useDocumentStore.getState().pages.length - 1)
        return
      }

      if (e.repeat) return
      const tool = TOOL_BY_KEY[lower]
      if (!tool) return
      const { pages, setTool, setSignatureOpen, formFields } = useDocumentStore.getState()
      if (pages.length === 0) return
      e.preventDefault()
      if (tool === 'signature') {
        setSignatureOpen(true)
        return
      }
      if (tool === 'image') {
        document.getElementById('image-file-input')?.click()
        return
      }
      if (tool === 'form' && formFields.length === 0) {
        useToastStore.getState().show(
          'PDF này không có ô form sẵn. Điền form chỉ dùng với file tờ khai, đơn, phiếu đã có ô trống.',
          'info',
        )
        return
      }
      setTool(tool)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [helpOpen, toggleHelp, closeHelp])

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (useDocumentStore.getState().pages.length === 0) return
      e.preventDefault()
      const { zoom, setZoom } = useDocumentStore.getState()
      setZoom(zoom + (e.deltaY > 0 ? -0.1 : 0.1))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])
}
