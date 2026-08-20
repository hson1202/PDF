export type PdfRect = { x: number; y: number; width: number; height: number }

export function toUnderlineRect(rect: PdfRect): PdfRect {
  const thickness = Math.max(1.15, Math.min(2.8, rect.height * 0.085))
  return {
    x: rect.x,
    y: rect.y + rect.height - thickness * 0.35,
    width: rect.width,
    height: thickness,
  }
}

export function mergeLineRects(rects: PdfRect[]): PdfRect[] {
  if (rects.length <= 1) return rects
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const out: PdfRect[] = []
  for (const r of sorted) {
    const last = out[out.length - 1]
    const sameLine =
      last &&
      Math.abs(r.y - last.y) <= Math.max(r.height, last.height) * 0.45 &&
      r.x <= last.x + last.width + Math.max(r.height, last.height) * 0.55
    if (!sameLine || !last) {
      out.push({ ...r })
      continue
    }
    const x = Math.min(last.x, r.x)
    const y = Math.min(last.y, r.y)
    const right = Math.max(last.x + last.width, r.x + r.width)
    const bottom = Math.max(last.y + last.height, r.y + r.height)
    last.x = x
    last.y = y
    last.width = right - x
    last.height = bottom - y
  }
  return out
}

type PageSpace = { width: number; height: number; rotation?: number }

function textOffsetInSpan(span: HTMLElement, node: Node, offset: number) {
  if (node === span) {
    const len = span.textContent?.length ?? 0
    return Math.max(0, Math.min(offset, len))
  }
  const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT)
  let acc = 0
  let current: Node | null
  while ((current = walker.nextNode())) {
    const len = current.textContent?.length ?? 0
    if (current === node) return acc + Math.max(0, Math.min(offset, len))
    acc += len
  }
  return acc
}

function spanPageRect(span: HTMLElement, layer: HTMLElement, page: PageSpace): PdfRect | null {
  const leftPct = parseFloat(span.style.left)
  const topPct = parseFloat(span.style.top)
  if (!Number.isFinite(leftPct) || !Number.isFinite(topPct)) return null

  const x = (leftPct / 100) * page.width
  const y = (topPct / 100) * page.height
  const fontHeight = parseFloat(span.style.getPropertyValue('--font-height'))
  const scaleX = parseFloat(span.style.getPropertyValue('--scale-x') || '1') || 1
  const cssW = layer.offsetWidth || page.width
  const cssH = layer.offsetHeight || page.height
  if (cssW < 1 || cssH < 1) return null

  let width = 0
  let height = Number.isFinite(fontHeight) && fontHeight > 0 ? fontHeight : 0

  if (span.offsetWidth > 0) {
    const minInv = parseFloat(getComputedStyle(span).getPropertyValue('--min-font-size-inv')) || 1
    width = (span.offsetWidth * scaleX * minInv * page.width) / cssW
    if (height <= 0) height = (span.offsetHeight * minInv * page.height) / cssH
  }

  if (width < 0.6 || height < 0.6) {
    const box = span.getBoundingClientRect()
    const layerBox = layer.getBoundingClientRect()
    if (box.width < 1 || box.height < 1 || layerBox.width < 1 || layerBox.height < 1) return null
    const swapped = (page.rotation ?? 0) % 180 !== 0
    width = ((swapped ? box.height : box.width) / (swapped ? layerBox.height : layerBox.width)) * page.width
    if (height <= 0) {
      height = ((swapped ? box.width : box.height) / (swapped ? layerBox.width : layerBox.height)) * page.height
    }
  }

  if (width < 0.6 || height < 0.6) return null
  return { x, y, width, height }
}

function clipRangeToSpan(span: HTMLElement, range: Range) {
  const clipped = range.cloneRange()
  const startIn = range.startContainer === span || span.contains(range.startContainer)
  const endIn = range.endContainer === span || span.contains(range.endContainer)
  try {
    if (!startIn) clipped.setStart(span, 0)
    if (!endIn) {
      const last = span.lastChild
      if (last) clipped.setEndAfter(last)
      else clipped.setEnd(span, span.childNodes.length)
    }
  } catch {
    return null
  }
  return clipped
}

function clipSpanRect(span: HTMLElement, range: Range, layer: HTMLElement, page: PageSpace): PdfRect | null {
  const full = spanPageRect(span, layer, page)
  if (!full) return null
  const text = span.textContent ?? ''
  const len = text.length
  if (len === 0) return null

  const clipped = clipRangeToSpan(span, range)
  if (clipped) {
    const spanRange = document.createRange()
    spanRange.selectNodeContents(span)
    const fullBox = spanRange.getBoundingClientRect()
    const clipBox = clipped.getBoundingClientRect()
    if (fullBox.width >= 1 && clipBox.width >= 0.5) {
      const leftRatio = Math.max(0, (clipBox.left - fullBox.left) / fullBox.width)
      const rightRatio = Math.min(1, (clipBox.right - fullBox.left) / fullBox.width)
      if (rightRatio - leftRatio > 0.02) {
        return {
          x: full.x + leftRatio * full.width,
          y: full.y,
          width: (rightRatio - leftRatio) * full.width,
          height: full.height,
        }
      }
    }
  }

  const startIn = range.startContainer === span || span.contains(range.startContainer)
  const endIn = range.endContainer === span || span.contains(range.endContainer)
  const start = startIn ? textOffsetInSpan(span, range.startContainer, range.startOffset) : 0
  const end = endIn ? textOffsetInSpan(span, range.endContainer, range.endOffset) : len
  if (end <= start) return null

  const trimStart = start + (text.slice(start, end).match(/^\s*/)?.[0].length ?? 0)
  const trimEnd = end - (text.slice(start, end).match(/\s*$/)?.[0].length ?? 0)
  if (trimEnd <= trimStart) return null

  return {
    x: full.x + (trimStart / len) * full.width,
    y: full.y,
    width: ((trimEnd - trimStart) / len) * full.width,
    height: full.height,
  }
}

export function selectionRectsInLayer(layer: HTMLElement, page: PageSpace): PdfRect[] {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return []

  const range = sel.getRangeAt(0)
  const root = range.commonAncestorContainer
  const rootEl = root instanceof Element ? root : root.parentElement
  if (!rootEl || (rootEl !== layer && !layer.contains(rootEl))) return []

  const raw: PdfRect[] = []
  const spans = layer.querySelectorAll<HTMLElement>('span')
  for (const span of spans) {
    if (span.classList.contains('endOfContent') || span.classList.contains('markedContent')) continue
    if (!(span.textContent ?? '').trim()) continue
    if (!range.intersectsNode(span)) continue
    const rect = clipSpanRect(span, range, layer, page)
    if (!rect) continue
    if (rect.height > page.height * 0.45) continue
    raw.push(rect)
  }
  return mergeLineRects(raw)
}
