import {
  AnnotationMode,
  GlobalWorkerOptions,
  TextLayer,
  Util,
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
} from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorker

const cache = new Map<string, Promise<PDFDocumentProxy>>()

export { AnnotationMode, TextLayer, Util }
export type { PDFDocumentProxy, PDFPageProxy, PageViewport }

export function loadPdfjsDocument(sourceId: string, bytes: Uint8Array) {
  let pending = cache.get(sourceId)
  if (!pending) {
    pending = getDocument({ data: bytes.slice() }).promise
    cache.set(sourceId, pending)
  }
  return pending
}

export async function getPdfjsPage(
  sourceId: string,
  bytes: Uint8Array,
  sourcePageIndex: number,
) {
  const doc = await loadPdfjsDocument(sourceId, bytes)
  return await doc.getPage(sourcePageIndex + 1)
}

export function clearPdfjsCache() {
  for (const pending of cache.values()) {
    void pending.then((doc) => doc.cleanup()).catch(() => undefined)
  }
  cache.clear()
}
