import type { FormFieldMeta, PageMeta, TextItemBox } from '@/types'
import { uid } from '@/lib/utils'
import {
  Util,
  type PDFDocumentProxy,
  type PDFPageProxy,
  type PageViewport,
} from '@/lib/pdf/pdfjs'

export async function extractFormFields(
  pdf: PDFDocumentProxy,
  pages: PageMeta[],
  sourceId: string,
): Promise<FormFieldMeta[]> {
  const fields: FormFieldMeta[] = []

  for (const pageMeta of pages) {
    if (pageMeta.sourceId !== sourceId) continue
    const page = await pdf.getPage(pageMeta.sourcePageIndex + 1)
    const viewport = page.getViewport({ scale: 1 })
    const annots = (await page.getAnnotations()) as Array<Record<string, unknown>>

    for (const annot of annots) {
      if (annot.subtype !== 'Widget' || typeof annot.fieldName !== 'string') continue
      const rect = annot.rect as number[] | undefined
      if (!rect || rect.length < 4) continue

      const p1 = viewport.convertToViewportPoint(rect[0], rect[1]) as [number, number]
      const p2 = viewport.convertToViewportPoint(rect[2], rect[3]) as [number, number]
      const x = Math.min(p1[0], p2[0])
      const y = Math.min(p1[1], p2[1])
      const width = Math.abs(p2[0] - p1[0])
      const height = Math.abs(p2[1] - p1[1])

      const fieldType = String(annot.fieldType ?? '')
      let type: FormFieldMeta['type'] = 'text'
      let value: string | boolean = ''
      let options: string[] | undefined

      if (fieldType === 'Btn' && annot.checkBox) {
        type = 'checkbox'
        value = annot.fieldValue !== 'Off' && Boolean(annot.fieldValue)
      } else if (fieldType === 'Btn' && annot.radioButton) {
        type = 'radio'
        value = String(annot.fieldValue ?? '')
        const buttonValue = annot.buttonValue
        options = buttonValue != null ? [String(buttonValue)] : undefined
      } else if (fieldType === 'Ch') {
        type = 'dropdown'
        const rawOpts = annot.options as Array<{ exportValue?: string; displayValue?: string }> | undefined
        options = rawOpts?.map((o) => o.exportValue || o.displayValue || '').filter(Boolean)
        const fieldValue = annot.fieldValue
        value = Array.isArray(fieldValue) ? String(fieldValue[0] ?? '') : String(fieldValue ?? '')
      } else if (fieldType === 'Tx' || fieldType === '') {
        type = 'text'
        value = String(annot.fieldValue ?? '')
      } else {
        continue
      }

      fields.push({
        id: uid(),
        pageId: pageMeta.id,
        sourceId,
        name: annot.fieldName,
        type,
        x,
        y,
        width,
        height,
        options,
        value,
      })
    }
  }

  return fields
}

type RawGlyph = {
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  ascent: number
  baseline: number
  hasEOL: boolean
}

const ascentCache = new Map<string, number>()

function ascentRatio(fontFamily: string, style?: { ascent?: number; descent?: number }): number {
  if (style?.ascent && style.ascent > 0.4 && style.ascent < 1.4) return style.ascent
  if (style?.descent) return Math.min(1.1, Math.max(0.55, 1 + style.descent))
  const cached = ascentCache.get(fontFamily)
  if (cached) return cached
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (ctx) {
      ctx.font = `100px ${fontFamily}`
      const m = ctx.measureText('Hgyp')
      const asc = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent
      const desc = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent
      if (asc && desc) {
        const ratio = asc / (asc + desc)
        ascentCache.set(fontFamily, ratio)
        return ratio
      }
    }
  } catch {
    // ignore
  }
  return 0.8
}

export function makeTextKey(x: number, y: number, str: string) {
  return `${Math.round(x * 2) / 2}:${Math.round(y * 2) / 2}:${str}`
}

function joinGlyphs(a: RawGlyph, b: RawGlyph): string {
  const gap = b.x - (a.x + a.width)
  const needSpace = gap > a.fontSize * 0.16 && !a.str.endsWith(' ') && !b.str.startsWith(' ')
  return needSpace ? `${a.str} ${b.str}` : `${a.str}${b.str}`
}

function mergeGlyphs(items: RawGlyph[]): TextItemBox {
  const first = items[0]
  let str = first.str
  for (let i = 1; i < items.length; i++) str = joinGlyphs({ ...items[i - 1], str }, items[i])
  const x = Math.min(...items.map((g) => g.x))
  const y = Math.min(...items.map((g) => g.y))
  const right = Math.max(...items.map((g) => g.x + g.width))
  const bottom = Math.max(...items.map((g) => g.y + g.height))
  const fontSize = items.reduce((s, g) => s + g.fontSize, 0) / items.length
  const ascent = items.reduce((s, g) => s + g.ascent, 0) / items.length
  return {
    id: uid(),
    key: makeTextKey(x, y, str),
    str,
    x,
    y,
    width: Math.max(right - x, 4),
    height: Math.max(bottom - y, fontSize * 0.7),
    fontSize,
    fontFamily: first.fontFamily,
    ascent,
  }
}

function groupPhrases(glyphs: RawGlyph[]): TextItemBox[] {
  const sorted = [...glyphs].sort((a, b) => a.baseline - b.baseline || a.x - b.x)
  const groups: RawGlyph[][] = []

  for (const glyph of sorted) {
    const prevGroup = groups[groups.length - 1]
    const prev = prevGroup?.[prevGroup.length - 1]
    if (!prev || prev.hasEOL) {
      groups.push([glyph])
      continue
    }
    const em = Math.max(prev.fontSize, glyph.fontSize)
    const sameLine = Math.abs(glyph.baseline - prev.baseline) < em * 0.32
    const similarSize = Math.abs(glyph.fontSize - prev.fontSize) < em * 0.22
    const gap = glyph.x - (prev.x + prev.width)
    const close = gap < em * 0.9 && gap > -em * 0.35
    if (sameLine && similarSize && close) prevGroup.push(glyph)
    else groups.push([glyph])
  }

  return groups.map(mergeGlyphs)
}

export async function extractTextBoxes(page: PDFPageProxy, viewport: PageViewport): Promise<TextItemBox[]> {
  const content = await page.getTextContent()
  const glyphs: RawGlyph[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const style = content.styles[item.fontName]
    const tx = Util.transform(viewport.transform, item.transform) as number[]
    const angle = Math.atan2(tx[1], tx[0])
    if (style?.vertical || Math.abs(angle) > 0.08) continue

    const fontSize = Math.hypot(tx[2], tx[3]) || item.height * viewport.scale || 10
    const fontFamily = style?.fontFamily || 'sans-serif'
    const ratio = ascentRatio(fontFamily, style)
    const ascent = fontSize * ratio
    const baseline = tx[5]
    const x = tx[4]
    const y = baseline - ascent
    const width = (item.width || 0) * viewport.scale
    if (width < 0.5 && item.str.trim().length === 0) continue
    const descent = fontSize * 0.12

    glyphs.push({
      str: item.str,
      x,
      y,
      width: Math.max(width, fontSize * 0.15),
      height: ascent + descent,
      fontSize,
      fontFamily,
      ascent,
      baseline,
      hasEOL: Boolean(item.hasEOL),
    })
  }

  return groupPhrases(glyphs)
}
