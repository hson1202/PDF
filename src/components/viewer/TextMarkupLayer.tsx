import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { getPdfjsPage, TextLayer } from '@/lib/pdf/pdfjs'
import {
  selectionRectsInLayer,
  toUnderlineRect,
  type PdfRect,
} from '@/lib/pdf/textMarkup'
import { uid } from '@/lib/utils'
import { useDocumentStore } from '@/store/documentStore'
import type { Annotation, PageMeta } from '@/types'

type Props = {
  page: PageMeta
  scale: number
}

function clientToPdf(el: HTMLElement, clientX: number, clientY: number, scale: number) {
  const r = el.getBoundingClientRect()
  return {
    x: (clientX - r.left) / scale,
    y: (clientY - r.top) / scale,
  }
}

function normRect(a: { x: number; y: number }, b: { x: number; y: number }): PdfRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) }
}

export function TextMarkupLayer({ page, scale }: Props) {
  const { tool, color, addAnnotations } = useDocumentStore()
  const source = useDocumentStore((s) => s.sources.find((d) => d.id === page.sourceId))
  const textRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const selectingRef = useRef(false)
  const [hasText, setHasText] = useState<boolean | null>(null)
  const [ghost, setGhost] = useState<PdfRect | null>(null)
  const active = tool === 'highlight' || tool === 'underline'
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const pageRef = useRef(page)
  toolRef.current = tool
  colorRef.current = color
  pageRef.current = page

  useEffect(() => {
    const container = textRef.current
    if (!container || !source) return
    let cancelled = false
    let layer: TextLayer | null = null

    void (async () => {
      const pdfPage = await getPdfjsPage(page.sourceId, source.bytes, page.sourcePageIndex)
      if (cancelled || !textRef.current) return
      const viewport = pdfPage.getViewport({ scale })
      container.style.setProperty('--scale-factor', String(scale))
      container.style.setProperty('--user-unit', '1')
      container.style.setProperty('--total-scale-factor', String(scale))
      container.style.setProperty('--scale-round-x', '1px')
      container.style.setProperty('--scale-round-y', '1px')
      layer = new TextLayer({
        textContentSource: pdfPage.streamTextContent({ includeMarkedContent: true }),
        container,
        viewport,
      })
      try {
        await layer.render()
      } catch {
        if (!cancelled) setHasText(false)
        return
      }
      if (cancelled) {
        try {
          layer.cancel()
        } catch {
          // ignore
        }
        return
      }
      container.style.width = '100%'
      container.style.height = '100%'
      const end = document.createElement('div')
      end.className = 'endOfContent'
      container.append(end)
      setHasText(layer.textDivs.some((d) => (d.textContent ?? '').trim().length > 0))
    })()

    return () => {
      cancelled = true
      try {
        layer?.cancel()
      } catch {
        // ignore
      }
      container.replaceChildren()
      setHasText(null)
    }
  }, [page.id, page.sourceId, page.sourcePageIndex, scale, source])

  useEffect(() => {
    if (!active || hasText !== true) return
    const container = textRef.current
    if (!container) return

    const commit = () => {
      const currentTool = toolRef.current
      if (currentTool !== 'highlight' && currentTool !== 'underline') return
      const rects = selectionRectsInLayer(container, pageRef.current)
      window.getSelection()?.removeAllRanges()
      container.classList.remove('selecting')
      if (rects.length === 0) return
      const drawn = currentTool === 'underline' ? rects.map(toUnderlineRect) : rects
      const anns: Annotation[] = drawn.map((r) => ({
        id: uid(),
        pageId: page.id,
        type: currentTool,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        color: colorRef.current,
      }))
      addAnnotations(anns)
    }

    const onDown = () => {
      selectingRef.current = true
      container.classList.add('selecting')
    }
    const onUp = () => {
      if (!selectingRef.current) return
      selectingRef.current = false
      window.requestAnimationFrame(commit)
    }
    const onCancel = () => {
      selectingRef.current = false
      container.classList.remove('selecting')
      window.getSelection()?.removeAllRanges()
    }

    container.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      container.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      container.classList.remove('selecting')
    }
  }, [active, hasText, addAnnotations, page.id, page.width, page.height])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!active || hasText !== false || e.button !== 0) return
    e.preventDefault()
    const el = wrapRef.current
    if (!el) return
    el.setPointerCapture(e.pointerId)
    startRef.current = clientToPdf(el, e.clientX, e.clientY, scale)
    setGhost(null)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    const el = wrapRef.current
    if (!start || !el) return
    setGhost(normRect(start, clientToPdf(el, e.clientX, e.clientY, scale)))
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    const el = wrapRef.current
    startRef.current = null
    setGhost(null)
    if (!start || !el || !active || hasText !== false) return
    try {
      el.releasePointerCapture(e.pointerId)
    } catch {
      // already released
    }
    const sel = normRect(start, clientToPdf(el, e.clientX, e.clientY, scale))
    if (tool === 'highlight' && (sel.width < 4 || sel.height < 4)) return
    if (tool === 'underline' && sel.width < 4) return
    const drawn = tool === 'underline' ? [toUnderlineRect(sel)] : [sel]
    addAnnotations(
      drawn.map((r) => ({
        id: uid(),
        pageId: page.id,
        type: tool,
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        color,
      })),
    )
  }

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      style={{
        zIndex: 5,
        pointerEvents: active && hasText === false ? 'auto' : 'none',
        cursor: active ? 'text' : 'default',
        touchAction: active ? 'none' : undefined,
        userSelect: 'none',
        ['--markup-color' as string]: color,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startRef.current = null
        setGhost(null)
      }}
    >
      <div
        ref={textRef}
        className="pdf-text-layer textLayer"
        style={{
          pointerEvents: active && hasText ? 'auto' : 'none',
          userSelect: active && hasText ? 'text' : 'none',
        }}
      />
      {ghost ? (
        <div
          className="pointer-events-none absolute"
          style={{
            left: ghost.x * scale,
            top: tool === 'underline' ? (ghost.y + ghost.height) * scale - 2 : ghost.y * scale,
            width: ghost.width * scale,
            height: tool === 'underline' ? 2 : ghost.height * scale,
            background: color,
            opacity: 0.28,
          }}
        />
      ) : null}
      {active && hasText === false ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
          <span className="rounded-full bg-zinc-900/85 px-3 py-1 text-xs text-white">
            PDF scan / ảnh — kéo ô để {tool === 'highlight' ? 'tô màu' : 'gạch chân'}
          </span>
        </div>
      ) : null}
    </div>
  )
}
