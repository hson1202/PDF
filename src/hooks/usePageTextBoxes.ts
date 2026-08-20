import { useEffect, useState } from 'react'
import { extractTextBoxes } from '@/lib/pdf/extract'
import { getPdfjsPage } from '@/lib/pdf/pdfjs'
import { useDocumentStore } from '@/store/documentStore'
import type { PageMeta, TextItemBox } from '@/types'

const cache = new Map<string, TextItemBox[]>()
const inflight = new Map<string, Promise<TextItemBox[]>>()

function cacheKey(page: PageMeta) {
  return `${page.sourceId}:${page.sourcePageIndex}`
}

async function loadBoxes(page: PageMeta, bytes: Uint8Array) {
  const key = cacheKey(page)
  const hit = cache.get(key)
  if (hit) return hit
  const pending = inflight.get(key)
  if (pending) return pending

  const task = (async () => {
    const pdfPage = await getPdfjsPage(page.sourceId, bytes, page.sourcePageIndex)
    const viewport = pdfPage.getViewport({ scale: 1 })
    const items = await extractTextBoxes(pdfPage, viewport)
    cache.set(key, items)
    inflight.delete(key)
    return items
  })()

  inflight.set(key, task)
  return task
}

export function usePageTextBoxes(page: PageMeta) {
  const source = useDocumentStore((s) => s.sources.find((d) => d.id === page.sourceId))
  const [boxes, setBoxes] = useState<TextItemBox[]>(() => cache.get(cacheKey(page)) ?? [])
  const [ready, setReady] = useState(() => cache.has(cacheKey(page)))

  useEffect(() => {
    if (!source) return
    const key = cacheKey(page)
    let cancelled = false
    const cached = cache.get(key)
    if (cached) {
      setBoxes(cached)
      setReady(true)
      return
    }
    setReady(false)
    void loadBoxes(page, source.bytes).then((items) => {
      if (!cancelled) {
        setBoxes(items)
        setReady(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [page.id, page.sourceId, page.sourcePageIndex, source])

  return { boxes, ready }
}
