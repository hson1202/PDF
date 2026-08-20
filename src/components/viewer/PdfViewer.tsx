import { useEffect, useRef } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { EmptyState } from '@/components/viewer/EmptyState'
import { PdfPageView } from '@/components/viewer/PdfPageView'
import { computeFitZoom } from '@/lib/zoom'

export function PdfViewer() {
  const { pages, openPdf, loading, zoomMode, currentPageIndex, setZoomFit } = useDocumentStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el || pages.length === 0) return
    if (zoomMode !== 'fitWidth' && zoomMode !== 'fitPage') return

    const apply = () => {
      const page = useDocumentStore.getState().pages[useDocumentStore.getState().currentPageIndex]
      if (!page) return
      const zoom = computeFitZoom(
        page,
        { width: el.clientWidth, height: el.clientHeight },
        zoomMode,
      )
      setZoomFit(zoomMode, zoom)
    }

    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [zoomMode, pages, currentPageIndex, setZoomFit])

  useEffect(() => {
    const el = scrollRef.current
    if (!el || pages.length === 0) return

    let frame = 0
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        const rootRect = el.getBoundingClientRect()
        const target = el.clientHeight * 0.38
        let best = 0
        let bestDist = Infinity
        for (let i = 0; i < pages.length; i++) {
          const node = document.getElementById(`page-${pages[i].id}`)
          if (!node) continue
          const rect = node.getBoundingClientRect()
          const center = rect.top + rect.height / 2 - rootRect.top
          const dist = Math.abs(center - target)
          if (dist < bestDist) {
            bestDist = dist
            best = i
          }
        }
        const { currentPageIndex, setCurrentPage } = useDocumentStore.getState()
        if (best !== currentPageIndex) setCurrentPage(best)
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [pages])

  if (pages.length === 0) return <EmptyState />

  return (
    <div
      ref={scrollRef}
      className="viewer-scroll h-full overflow-auto py-6"
      onDragOver={(e) => {
        e.preventDefault()
      }}
      onDrop={(e) => {
        e.preventDefault()
        const file = [...e.dataTransfer.files].find(
          (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
        )
        if (file) void openPdf(file)
      }}
    >
      {loading && (
        <div className="mb-3 text-center text-sm text-zinc-500">Đang xử lý PDF…</div>
      )}
      {pages.map((page, index) => (
        <PdfPageView key={page.id} page={page} index={index} />
      ))}
    </div>
  )
}
