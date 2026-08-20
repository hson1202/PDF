import { useDocumentStore } from '@/store/documentStore'
import type { PageMeta, ZoomFitMode } from '@/types'

const PAD_X = 32
const PAD_Y = 56

export function computeFitZoom(
  page: Pick<PageMeta, 'width' | 'height' | 'rotation'>,
  container: { width: number; height: number },
  mode: ZoomFitMode,
): number {
  if (mode === 'actual') return 1
  const swap = page.rotation % 180 !== 0
  const pageW = swap ? page.height : page.width
  const pageH = swap ? page.width : page.height
  if (pageW <= 0 || pageH <= 0 || container.width <= 0 || container.height <= 0) return 1
  const zoomW = (container.width - PAD_X) / pageW
  const zoomH = (container.height - PAD_Y) / pageH
  const zoom = mode === 'fitWidth' ? zoomW : Math.min(zoomW, zoomH)
  return Math.min(3, Math.max(0.4, zoom))
}

export function applyFitZoom(mode: ZoomFitMode) {
  const { pages, currentPageIndex, setZoomFit } = useDocumentStore.getState()
  const page = pages[currentPageIndex]
  if (!page) return
  if (mode === 'actual') {
    setZoomFit('actual', 1)
    return
  }
  const el = document.querySelector('.viewer-scroll') as HTMLElement | null
  if (!el) return
  const zoom = computeFitZoom(page, { width: el.clientWidth, height: el.clientHeight }, mode)
  setZoomFit(mode, zoom)
}
