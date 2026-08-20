import { useEffect, useRef, useState } from 'react'
import { AnnotationMode, getPdfjsPage } from '@/lib/pdf/pdfjs'
import { useDocumentStore } from '@/store/documentStore'
import type { PageMeta } from '@/types'
import { AnnotationLayer } from '@/components/viewer/AnnotationLayer'
import { FormLayer } from '@/components/viewer/FormLayer'
import { TextEditLayer } from '@/components/viewer/TextEditLayer'
import { TextMarkupLayer } from '@/components/viewer/TextMarkupLayer'

type Props = {
  page: PageMeta
  index: number
}

export function PdfPageView({ page, index }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const { sources, zoom, currentPageIndex } = useDocumentStore()
  const [visible, setVisible] = useState(index < 2)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const scale = zoom
  const cssW = page.width * scale
  const cssH = page.height * scale
  const swap = page.rotation % 180 !== 0
  const displayW = swap ? cssH : cssW
  const displayH = swap ? cssW : cssH

  useEffect(() => {
    if (!visible) return
    const source = sources.find((s) => s.id === page.sourceId)
    const canvas = canvasRef.current
    if (!source || !canvas) return
    let cancelled = false
    const taskRef: { cancel?: () => void } = {}
    void (async () => {
      const pdfPage = await getPdfjsPage(source.id, source.bytes, page.sourcePageIndex)
      if (cancelled) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = pdfPage.getViewport({ scale: scale * dpr })
      canvas.width = viewport.width
      canvas.height = viewport.height
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const task = pdfPage.render({
        canvas,
        canvasContext: ctx,
        viewport,
        annotationMode: AnnotationMode.ENABLE_FORMS,
      })
      taskRef.cancel = () => task.cancel()
      try {
        await task.promise
      } catch {
        // cancelled
      }
    })()
    return () => {
      cancelled = true
      taskRef.cancel?.()
    }
  }, [visible, sources, page.sourceId, page.sourcePageIndex, scale, cssW, cssH])

  return (
    <div
      ref={wrapRef}
      id={`page-${page.id}`}
      className="relative mx-auto mb-6 bg-white shadow-md"
      style={{ width: displayW, height: displayH }}
    >
      <div
        className="absolute"
        style={{
          width: cssW,
          height: cssH,
          left: (displayW - cssW) / 2,
          top: (displayH - cssH) / 2,
          transform: page.rotation ? `rotate(${page.rotation}deg)` : undefined,
        }}
      >
        {visible ? (
          <>
            <canvas ref={canvasRef} className="block" />
            {index === currentPageIndex || visible ? (
              <>
                <AnnotationLayer page={page} scale={scale} width={cssW} height={cssH} />
                <FormLayer page={page} scale={scale} />
                <TextMarkupLayer page={page} scale={scale} />
                <TextEditLayer page={page} scale={scale} />
              </>
            ) : null}
          </>
        ) : (
          <div className="h-full w-full bg-zinc-100" />
        )}
      </div>
    </div>
  )
}
