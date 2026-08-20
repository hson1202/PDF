import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { AnnotationMode, getPdfjsPage } from '@/lib/pdf/pdfjs'
import { useDocumentStore } from '@/store/documentStore'
import type { PageMeta } from '@/types'
import { cn } from '@/lib/utils'

type Props = {
  page: PageMeta
  index: number
  active: boolean
  selected: boolean
  onClick: () => void
  onToggleSelect: () => void
  onDrop: (from: number, to: number) => void
}

export function Thumbnail({ page, index, active, selected, onClick, onToggleSelect, onDrop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sources = useDocumentStore((s) => s.sources)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const source = sources.find((s) => s.id === page.sourceId)
    const canvas = canvasRef.current
    if (!source || !canvas) return
    let cancelled = false
    void (async () => {
      const pdfPage = await getPdfjsPage(source.id, source.bytes, page.sourcePageIndex)
      if (cancelled) return
      const viewport = pdfPage.getViewport({ scale: 0.18 })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      await pdfPage.render({ canvas, canvasContext: ctx, viewport, annotationMode: AnnotationMode.ENABLE }).promise
    })()
    return () => {
      cancelled = true
    }
  }, [page.sourceId, page.sourcePageIndex, sources])

  const swap = page.rotation % 180 !== 0

  return (
    <div
      draggable
      onDragStart={(e: DragEvent) => {
        e.dataTransfer.setData('text/plain', String(index))
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const from = Number(e.dataTransfer.getData('text/plain'))
        if (!Number.isNaN(from)) onDrop(from, index)
      }}
      className={cn(
        'relative cursor-pointer rounded-lg border bg-white p-1.5',
        active ? 'border-blue-500 ring-2 ring-blue-200' : 'border-zinc-200',
        selected && 'bg-blue-50',
        dragging && 'opacity-50',
      )}
      onClick={onClick}
    >
      <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span>Trang {index + 1}</span>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div
        className="mx-auto overflow-hidden rounded bg-zinc-100"
        style={{
          width: (swap ? page.height : page.width) * 0.18,
          height: (swap ? page.width : page.height) * 0.18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <canvas ref={canvasRef} style={{ transform: `rotate(${page.rotation}deg)`, transformOrigin: 'center' }} />
      </div>
    </div>
  )
}
