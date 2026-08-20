import type { Annotation, DrawAnnotation, ImageAnnotation, TextBoxAnnotation } from '@/types'
import { cssFontShorthand, ensureCssFonts } from '@/lib/fonts'

const EXPORT_SCALE = 2

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Không tải được ảnh'))
    img.src = src
  })
}

async function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
  if (ann.type === 'highlight' || ann.type === 'underline') {
    ctx.save()
    ctx.fillStyle = ann.color
    ctx.globalAlpha = ann.type === 'highlight' ? 0.42 : 1
    ctx.fillRect(ann.x, ann.y, ann.width, ann.height)
    ctx.restore()
    return
  }

  if (ann.type === 'draw') {
    const draw = ann as DrawAnnotation
    if (draw.points.length < 2) return
    ctx.save()
    ctx.strokeStyle = draw.color
    ctx.lineWidth = draw.strokeWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(draw.points[0].x, draw.points[0].y)
    for (let i = 1; i < draw.points.length; i++) {
      ctx.lineTo(draw.points[i].x, draw.points[i].y)
    }
    ctx.stroke()
    ctx.restore()
    return
  }

  if (ann.type === 'text' || ann.type === 'sticky') {
    const box = ann as TextBoxAnnotation
    ctx.save()
    if (box.type === 'sticky') {
      ctx.fillStyle = '#fef08a'
      ctx.strokeStyle = '#eab308'
      ctx.lineWidth = 1
      ctx.fillRect(box.x, box.y, box.width, box.height)
      ctx.strokeRect(box.x, box.y, box.width, box.height)
    } else if (box.fillColor) {
      ctx.fillStyle = box.fillColor
      ctx.fillRect(box.x, box.y, box.width, box.height)
    }
    ctx.fillStyle = box.color
    ctx.font = cssFontShorthand(box.fontFamily, box.fontSize, box.bold, box.italic)
    ctx.textBaseline = 'top'
    ctx.textAlign = box.align === 'center' ? 'center' : box.align === 'right' ? 'right' : 'left'
    const lines = box.text.split('\n')
    const tx =
      box.align === 'center' ? box.x + box.width / 2 : box.align === 'right' ? box.x + box.width - 4 : box.x + 4
    const lineH = box.fontSize + 3
    lines.forEach((line, i) => {
      const y = box.y + 4 + i * lineH
      ctx.fillText(line, tx, y, box.width - 8)
      if (box.underline && line) {
        const w = Math.min(ctx.measureText(line).width, box.width - 8)
        const x =
          box.align === 'center' ? tx - w / 2 : box.align === 'right' ? tx - w : tx
        ctx.fillRect(x, y + box.fontSize * 0.92, w, Math.max(1, box.fontSize * 0.07))
      }
    })
    ctx.restore()
    return
  }

  const imageAnn = ann as ImageAnnotation
  try {
    const img = await loadImage(imageAnn.dataUrl)
    ctx.drawImage(img, imageAnn.x, imageAnn.y, imageAnn.width, imageAnn.height)
  } catch {
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.fillRect(imageAnn.x, imageAnn.y, imageAnn.width, imageAnn.height)
  }
}

export async function renderAnnotationsPng(
  annotations: Annotation[],
  width: number,
  height: number,
): Promise<Uint8Array | null> {
  if (annotations.length === 0) return null
  await ensureCssFonts()
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * EXPORT_SCALE))
  canvas.height = Math.max(1, Math.round(height * EXPORT_SCALE))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE)
  for (const ann of annotations) {
    await drawAnnotation(ctx, ann)
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return null
  return new Uint8Array(await blob.arrayBuffer())
}
