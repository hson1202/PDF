export type CoverRect = {
  x: number
  y: number
  width: number
  height: number
}

export type RgbColor = { r: number; g: number; b: number }

export const COVER_PAD = 0.35
export const FIT_FONT_MIN_SCALE = 0.55
export const FALLBACK_BG = '#ffffff'
export const FALLBACK_BG_RGB: RgbColor = { r: 255, g: 255, b: 255 }

export function tightCover(box: CoverRect): CoverRect {
  return {
    x: box.x - COVER_PAD,
    y: box.y - COVER_PAD,
    width: Math.max(0.5, box.width + COVER_PAD * 2),
    height: Math.max(0.5, box.height + COVER_PAD * 2),
  }
}

export function fitFontSize(measuredWidth: number, size: number, maxWidth: number): number {
  if (!(size > 0) || !(maxWidth > 0) || measuredWidth <= maxWidth) return size
  return Math.max(size * FIT_FONT_MIN_SCALE, (size * maxWidth) / measuredWidth)
}

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx() {
  if (measureCtx) return measureCtx
  const canvas = document.createElement('canvas')
  measureCtx = canvas.getContext('2d')
  return measureCtx
}

export function measureCssTextWidth(text: string, font: string): number {
  if (!text) return 0
  const ctx = getMeasureCtx()
  if (!ctx) return text.length * 8
  ctx.font = font
  return ctx.measureText(text).width
}

export function rgbToHex(color: RgbColor): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(color.r)}${h(color.g)}${h(color.b)}`
}

function median(values: number[]): number {
  if (values.length === 0) return 255
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[sorted.length >> 1] ?? 255
}

function medianRgb(rs: number[], gs: number[], bs: number[]): RgbColor | null {
  if (rs.length === 0) return null
  return { r: median(rs), g: median(gs), b: median(bs) }
}

export function sampleBackgroundRgb(
  canvas: HTMLCanvasElement | null | undefined,
  box: CoverRect,
  pageWidth: number,
  pageHeight: number,
): RgbColor | null {
  if (!canvas || pageWidth <= 0 || pageHeight <= 0 || canvas.width < 2 || canvas.height < 2) return null
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const sx = canvas.width / pageWidth
  const sy = canvas.height / pageHeight
  const ring = 2
  const left = Math.max(0, Math.floor(box.x * sx) - ring)
  const top = Math.max(0, Math.floor(box.y * sy) - ring)
  const right = Math.min(canvas.width, Math.ceil((box.x + box.width) * sx) + ring)
  const bottom = Math.min(canvas.height, Math.ceil((box.y + box.height) * sy) + ring)
  const w = right - left
  const h = bottom - top
  if (w < 1 || h < 1) return null

  let data: ImageData
  try {
    data = ctx.getImageData(left, top, w, h)
  } catch {
    return null
  }

  const innerL = Math.floor(box.x * sx) - left
  const innerT = Math.floor(box.y * sy) - top
  const innerR = Math.ceil((box.x + box.width) * sx) - left
  const innerB = Math.ceil((box.y + box.height) * sy) - top
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const px = data.data

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = x >= innerL && x < innerR && y >= innerT && y < innerB
      if (inside) continue
      const i = (y * w + x) * 4
      if (px[i + 3] < 16) continue
      rs.push(px[i])
      gs.push(px[i + 1])
      bs.push(px[i + 2])
    }
  }

  const ringColor = medianRgb(rs, gs, bs)
  if (ringColor) return ringColor

  const corners = [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ]
  const cr: number[] = []
  const cg: number[] = []
  const cb: number[] = []
  for (const [x, y] of corners) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue
    const i = (y * w + x) * 4
    if (px[i + 3] < 16) continue
    cr.push(px[i])
    cg.push(px[i + 1])
    cb.push(px[i + 2])
  }
  return medianRgb(cr, cg, cb)
}

export function sampleBackground(
  canvas: HTMLCanvasElement | null | undefined,
  box: CoverRect,
  pageWidth: number,
  pageHeight: number,
): string {
  const rgb = sampleBackgroundRgb(canvas, box, pageWidth, pageHeight)
  return rgb ? rgbToHex(rgb) : FALLBACK_BG
}
