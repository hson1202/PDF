import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
  clip,
  endPath,
  pushGraphicsState,
  popGraphicsState,
  rectangle as pathRectangle,
  type PDFFont,
  type PDFPage,
  type PDFImage,
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type {
  Annotation,
  FormFieldMeta,
  PageMeta,
  SourceDoc,
  TextReplacement,
} from '@/types'
import { AnnotationMode, getPdfjsPage, type PDFPageProxy } from '@/lib/pdf/pdfjs'
import { renderAnnotationsPng } from '@/lib/pdf/overlay'
import { fontVariant, getFont, type FontId } from '@/lib/fonts'
import { hexToRgb } from '@/lib/utils'
import { FALLBACK_BG_RGB, fitFontSize, sampleBackgroundRgb, tightCover } from '@/lib/pdf/textCover'

export type ExportInput = {
  sources: SourceDoc[]
  pages: PageMeta[]
  annotations: Annotation[]
  textReplacements: TextReplacement[]
  formFields: FormFieldMeta[]
}

async function applyFormValues(doc: PDFDocument, sourceId: string, fields: FormFieldMeta[]) {
  const related = fields.filter((f) => f.sourceId === sourceId)
  if (related.length === 0) return
  const form = doc.getForm()

  for (const field of related) {
    try {
      if (field.type === 'text') {
        form.getTextField(field.name).setText(String(field.value ?? ''))
      } else if (field.type === 'checkbox') {
        const box = form.getCheckBox(field.name)
        if (field.value) box.check()
        else box.uncheck()
      } else if (field.type === 'dropdown') {
        const value = String(field.value ?? '')
        if (!value) continue
        try {
          form.getDropdown(field.name).select(value)
        } catch {
          form.getOptionList(field.name).select(value)
        }
      } else if (field.type === 'radio') {
        const value = String(field.value ?? '')
        if (value) form.getRadioGroup(field.name).select(value)
      }
    } catch {
      // Một số PDF form không chuẩn — bỏ qua field lỗi
    }
  }

  try {
    form.updateFieldAppearances()
  } catch {
    // ignore
  }
  try {
    form.flatten()
  } catch {
    // flatten có thể fail; giá trị vẫn được ghi
  }
}

async function fetchFontBytes(urls: string[]): Promise<ArrayBuffer | null> {
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      return await res.arrayBuffer()
    } catch {
      // thử url tiếp theo
    }
  }
  return null
}

function variantFallback(variant: ReturnType<typeof fontVariant>): ReturnType<typeof fontVariant>[] {
  if (variant === 'boldItalic') return ['boldItalic', 'bold', 'italic', 'regular']
  if (variant === 'italic') return ['italic', 'regular']
  if (variant === 'bold') return ['bold', 'regular']
  return ['regular']
}

async function embedAppFont(
  doc: PDFDocument,
  cache: Map<string, PDFFont>,
  fontId: FontId,
  bold: boolean,
  italic: boolean,
): Promise<PDFFont> {
  const key = `${fontId}:${bold ? 1 : 0}:${italic ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit

  const font = getFont(fontId)
  const wanted = fontVariant(bold, italic)
  for (const variant of variantFallback(wanted)) {
    const urls = font.ttf[variant]
    if (!urls?.length) continue
    const bytes = await fetchFontBytes(urls)
    if (!bytes) continue
    const embedded = await doc.embedFont(bytes, { subset: true })
    cache.set(key, embedded)
    return embedded
  }

  const fallback = cache.get('helvetica:0:0')
  if (fallback && key !== 'helvetica:0:0') {
    cache.set(key, fallback)
    return fallback
  }
  const standard = await doc.embedFont(StandardFonts.Helvetica)
  cache.set(key, standard)
  return standard
}

function pdfColor(hex: string) {
  const { r, g, b } = hexToRgb(hex || '#111827')
  return rgb(r / 255, g / 255, b / 255)
}

const SAMPLE_SCALE = 2

async function renderSampleCanvas(pdfPage: PDFPageProxy) {
  const viewport = pdfPage.getViewport({ scale: SAMPLE_SCALE })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  try {
    await pdfPage.render({
      canvas,
      canvasContext: ctx,
      viewport,
      annotationMode: AnnotationMode.ENABLE_FORMS,
    }).promise
  } catch {
    return null
  }
  return canvas
}

function drawOverlayImage(page: PDFPage, image: PDFImage, viewport: {
  width: number
  height: number
  rotation: number
  convertToPdfPoint: (x: number, y: number) => number[]
}) {
  const rotation = ((viewport.rotation % 360) + 360) % 360
  const origin = viewport.convertToPdfPoint(0, viewport.height) as [number, number]
  const options = {
    x: origin[0],
    y: origin[1],
    width: viewport.width,
    height: viewport.height,
    rotate: degrees(rotation),
  }
  if (rotation === 0) {
    page.drawImage(image, { x: origin[0], y: origin[1], width: viewport.width, height: viewport.height })
    return
  }
  page.drawImage(image, options)
}

export async function buildPdfBytes(input: ExportInput, pageIds?: string[]): Promise<Uint8Array> {
  const pages = pageIds
    ? input.pages.filter((p) => pageIds.includes(p.id))
    : input.pages
  if (pages.length === 0) throw new Error('Không có trang để xuất')

  const sourceDocs = new Map<string, PDFDocument>()
  for (const source of input.sources) {
    const doc = await PDFDocument.load(source.bytes, { ignoreEncryption: true })
    await applyFormValues(doc, source.id, input.formFields)
    sourceDocs.set(source.id, doc)
  }

  const out = await PDFDocument.create()
  out.registerFontkit(fontkit as never)
  const fontCache = new Map<string, PDFFont>()
  await embedAppFont(out, fontCache, 'helvetica', false, false)

  const copiedPages: PDFPage[] = []
  for (const meta of pages) {
    const src = sourceDocs.get(meta.sourceId)
    if (!src) continue
    const [copied] = await out.copyPages(src, [meta.sourcePageIndex])
    if (meta.rotation) {
      const current = copied.getRotation().angle
      copied.setRotation(degrees((current + meta.rotation) % 360))
    }
    out.addPage(copied)
    copiedPages.push(copied)
  }

  for (let i = 0; i < pages.length; i++) {
    const meta = pages[i]
    const page = copiedPages[i]
    const source = input.sources.find((s) => s.id === meta.sourceId)
    if (!source) continue

    const pdfjsPage = await getPdfjsPage(source.id, source.bytes, meta.sourcePageIndex)
    const viewport = pdfjsPage.getViewport({ scale: 1 })

    const replacements = input.textReplacements.filter((r) => r.pageId === meta.id)
    const sampleCanvas = replacements.length > 0 ? await renderSampleCanvas(pdfjsPage) : null
    for (const repl of replacements) {
      const text = repl.newText
      const size = repl.fontSize
      const usedFont = await embedAppFont(
        out,
        fontCache,
        repl.fontId ?? 'helvetica',
        Boolean(repl.bold),
        Boolean(repl.italic),
      )
      const cover = tightCover(repl)
      const bg = sampleBackgroundRgb(sampleCanvas, cover, meta.width, meta.height) ?? FALLBACK_BG_RGB
      const a = viewport.convertToPdfPoint(cover.x, cover.y) as [number, number]
      const b = viewport.convertToPdfPoint(cover.x + cover.width, cover.y + cover.height) as [number, number]
      const x = Math.min(a[0], b[0])
      const y = Math.min(a[1], b[1])
      const width = Math.abs(b[0] - a[0])
      const height = Math.abs(b[1] - a[1])
      page.drawRectangle({
        x,
        y,
        width,
        height,
        color: rgb(bg.r / 255, bg.g / 255, bg.b / 255),
        borderWidth: 0,
      })
      if (!text) continue
      const usedSize = fitFontSize(usedFont.widthOfTextAtSize(text, size), size, repl.width)
      const orig = repl.origFontSize || size
      const ascent = orig > 0.1 ? (repl.ascent || orig * 0.8) * (size / orig) : size * 0.8
      const origin = viewport.convertToPdfPoint(repl.x, repl.y + ascent) as [number, number]
      const textWidth = usedFont.widthOfTextAtSize(text, usedSize)
      page.pushOperators(pushGraphicsState(), pathRectangle(x, y, width, height), clip(), endPath())
      page.drawText(text, {
        x: origin[0],
        y: origin[1],
        size: usedSize,
        font: usedFont,
        color: pdfColor(repl.color || '#111827'),
      })
      if (repl.underline) {
        const thickness = Math.max(0.6, usedSize * 0.06)
        page.drawRectangle({
          x: origin[0],
          y: origin[1] - thickness * 1.4,
          width: textWidth,
          height: thickness,
          color: pdfColor(repl.color || '#111827'),
        })
      }
      if (repl.strikethrough) {
        const thickness = Math.max(0.5, usedSize * 0.055)
        // Gạch ngang ở khoảng 40% chiều cao tính từ baseline lên
        page.drawRectangle({
          x: origin[0],
          y: origin[1] + usedSize * 0.25,
          width: textWidth,
          height: thickness,
          color: pdfColor(repl.color || '#111827'),
        })
      }
      page.pushOperators(popGraphicsState())
    }

    const anns = input.annotations.filter((a) => a.pageId === meta.id)
    const png = await renderAnnotationsPng(anns, meta.width, meta.height)
    if (png) {
      const image = await out.embedPng(png)
      drawOverlayImage(page, image, viewport)
    }
  }

  return await out.save()
}
