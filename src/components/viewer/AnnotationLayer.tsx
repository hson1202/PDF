import { useEffect, useRef } from 'react'
import {
  Canvas,
  FabricImage,
  IText,
  PencilBrush,
  Point,
  Polyline,
  Rect,
  Textbox,
  util,
  type FabricObject,
  type Path,
} from 'fabric'
import { uid } from '@/lib/utils'
import { fontCssFamily } from '@/lib/fonts'
import { useDocumentStore } from '@/store/documentStore'
import type { Annotation, DrawAnnotation, ImageAnnotation, PageMeta, TextBoxAnnotation } from '@/types'

type Props = {
  page: PageMeta
  scale: number
  width: number
  height: number
}

function isDraw(ann: Annotation): ann is DrawAnnotation {
  return ann.type === 'draw'
}
function isText(ann: Annotation): ann is TextBoxAnnotation {
  return ann.type === 'text' || ann.type === 'sticky'
}
function isImage(ann: Annotation): ann is ImageAnnotation {
  return ann.type === 'image' || ann.type === 'signature'
}

type AnnObject = FabricObject & { annId?: string }

function setAnnId(obj: FabricObject, id: string) {
  ;(obj as AnnObject).annId = id
}

function getAnnId(obj: FabricObject | undefined) {
  return obj ? (obj as AnnObject).annId : undefined
}

function lockObject(obj: FabricObject) {
  obj.set({ lockRotation: true })
  obj.setControlsVisibility({ mtr: false })
}

async function addToCanvas(canvas: Canvas, ann: Annotation, scale: number, selectable: boolean) {
  const common = {
    selectable,
    evented: selectable,
    hasControls: selectable,
    lockRotation: true,
  }

  if (ann.type === 'highlight' || ann.type === 'underline') {
    const obj = new Rect({
      left: ann.x * scale,
      top: ann.y * scale,
      width: ann.width * scale,
      height: Math.max(ann.type === 'underline' ? 1.4 * scale : 1, ann.height * scale),
      fill: ann.color,
      strokeWidth: 0,
      opacity: ann.type === 'highlight' ? 0.42 : 1,
      rx: ann.type === 'highlight' ? 1 : 0,
      ry: ann.type === 'highlight' ? 1 : 0,
      objectCaching: false,
      ...common,
    })
    setAnnId(obj, ann.id)
    lockObject(obj)
    canvas.add(obj)
    return
  }

  if (isDraw(ann)) {
    const obj = new Polyline(
      ann.points.map((p) => ({ x: p.x * scale, y: p.y * scale })),
      {
        fill: '',
        stroke: ann.color,
        strokeWidth: ann.strokeWidth * scale,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        objectCaching: false,
        ...common,
      },
    )
    setAnnId(obj, ann.id)
    lockObject(obj)
    canvas.add(obj)
    return
  }

  if (isText(ann)) {
    const obj = new Textbox(ann.text, {
      left: ann.x * scale,
      top: ann.y * scale,
      width: ann.width * scale,
      fontSize: ann.fontSize * scale,
      fill: ann.color,
      fontFamily: fontCssFamily(ann.fontFamily),
      fontWeight: ann.bold ? 'bold' : 'normal',
      fontStyle: ann.italic ? 'italic' : 'normal',
      underline: Boolean(ann.underline),
      textAlign: ann.align || 'left',
      backgroundColor: ann.type === 'sticky' ? '#fef08a' : ann.fillColor || '',
      ...common,
    })
    setAnnId(obj, ann.id)
    lockObject(obj)
    canvas.add(obj)
    return
  }

  if (isImage(ann)) {
    const img = await FabricImage.fromURL(ann.dataUrl)
    img.set({
      left: ann.x * scale,
      top: ann.y * scale,
      scaleX: (ann.width * scale) / (img.width || 1),
      scaleY: (ann.height * scale) / (img.height || 1),
      ...common,
    })
    setAnnId(img, ann.id)
    lockObject(img)
    canvas.add(img)
  }
}

function objectToPatch(obj: FabricObject, scale: number): Partial<Annotation> {
  if (obj instanceof Polyline) {
    const matrix = obj.calcTransformMatrix()
    const points = (obj.points ?? []).map((p) => {
      const pt = util.transformPoint(new Point(p.x - obj.pathOffset.x, p.y - obj.pathOffset.y), matrix)
      return { x: pt.x / scale, y: pt.y / scale }
    })
    return { points } as Partial<DrawAnnotation>
  }
  const left = (obj.left ?? 0) / scale
  const top = (obj.top ?? 0) / scale
  const width = ((obj.width ?? 0) * (obj.scaleX ?? 1)) / scale
  const height = ((obj.height ?? 0) * (obj.scaleY ?? 1)) / scale
  if (obj instanceof IText || obj instanceof Textbox) {
    return {
      x: left,
      y: top,
      width,
      height,
      text: obj.text ?? '',
      fontSize: (obj.fontSize ?? 16) / scale,
    } as Partial<TextBoxAnnotation>
  }
  return { x: left, y: top, width, height }
}

function pathToPoints(path: Path, scale: number) {
  const points: { x: number; y: number }[] = []
  const matrix = path.calcTransformMatrix()
  for (const cmd of path.path) {
    const nums = cmd.slice(1) as number[]
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const p = util.transformPoint(
        new Point(nums[i] - path.pathOffset.x, nums[i + 1] - path.pathOffset.y),
        matrix,
      )
      points.push({ x: p.x / scale, y: p.y / scale })
    }
  }
  return points
}

export function AnnotationLayer({ page, scale, width, height }: Props) {
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const {
    tool,
    color,
    strokeWidth,
    textStyle,
    annotations,
    pendingImage,
    addAnnotation,
    updateAnnotation,
    setSelectedAnnotation,
    selectedAnnotationId,
    placePendingImage,
    checkpoint,
  } = useDocumentStore()

  const pageAnns = annotations.filter((a) => a.pageId === page.id)
  const textStyleRef = useRef(textStyle)
  textStyleRef.current = textStyle
  const annsKey = pageAnns
    .map((a) => {
      if (a.type === 'draw') {
        const p0 = a.points[0]
        const p1 = a.points[a.points.length - 1]
        return `${a.id}:${a.points.length}:${a.color}:${p0?.x.toFixed(1)}:${p0?.y.toFixed(1)}:${p1?.x.toFixed(1)}:${p1?.y.toFixed(1)}`
      }
      if (a.type === 'text' || a.type === 'sticky') {
        return `${a.id}:${a.x}:${a.y}:${a.width}:${a.height}:${a.text}:${a.fontFamily}:${a.fontSize}:${a.color}:${a.fillColor}:${a.bold}:${a.italic}:${a.underline}:${a.align}`
      }
      return `${a.id}:${a.x}:${a.y}:${a.width}:${a.height}`
    })
    .join('|')
  const canSelect = tool === 'select' && pageAnns.length > 0
  const interactive =
    canSelect || ['draw', 'text', 'sticky', 'image'].includes(tool) || Boolean(pendingImage)

  useEffect(() => {
    const el = canvasEl.current
    if (!el) return
    const canvas = new Canvas(el, {
      width,
      height,
      selection: tool === 'select',
      isDrawingMode: tool === 'draw',
      backgroundColor: 'transparent',
      defaultCursor: tool === 'select' ? 'default' : 'crosshair',
    })
    fabricRef.current = canvas

    if (tool === 'draw') {
      const brush = new PencilBrush(canvas)
      brush.color = color
      brush.width = strokeWidth * scale
      canvas.freeDrawingBrush = brush
    }

    let cancelled = false
    void (async () => {
      for (const ann of pageAnns) {
        if (cancelled) return
        await addToCanvas(canvas, ann, scale, tool === 'select')
      }
      canvas.renderAll()
    })()

    canvas.on('mouse:down', (opt) => {
      if (!opt.e) return
      const pointer = canvas.getScenePoint(opt.e)
      if (pendingImage) {
        placePendingImage(page.id, pointer.x / scale, pointer.y / scale)
        return
      }
      if (tool === 'text') {
        addAnnotation({
          id: uid(),
          pageId: page.id,
          type: 'text',
          x: pointer.x / scale,
          y: pointer.y / scale,
          width: 160,
          height: 28,
          text: 'Nhập chữ',
          fontSize: textStyleRef.current.fontSize,
          color: textStyleRef.current.color,
          fontFamily: textStyleRef.current.fontFamily,
          bold: textStyleRef.current.bold,
          italic: textStyleRef.current.italic,
          underline: textStyleRef.current.underline,
          align: textStyleRef.current.align,
          fillColor: textStyleRef.current.fillColor,
        })
        return
      }
      if (tool === 'sticky') {
        addAnnotation({
          id: uid(),
          pageId: page.id,
          type: 'sticky',
          x: pointer.x / scale,
          y: pointer.y / scale,
          width: 160,
          height: 90,
          text: 'Ghi chú',
          fontSize: textStyleRef.current.fontSize,
          color: textStyleRef.current.color,
          fontFamily: textStyleRef.current.fontFamily,
          bold: textStyleRef.current.bold,
          italic: textStyleRef.current.italic,
          underline: textStyleRef.current.underline,
          align: textStyleRef.current.align,
        })
        return
      }
    })

    canvas.on('path:created', (opt) => {
      const path = opt.path as Path
      const points = pathToPoints(path, scale)
      canvas.remove(path)
      if (points.length < 2) return
      addAnnotation({
        id: uid(),
        pageId: page.id,
        type: 'draw',
        points,
        color,
        strokeWidth,
      })
    })

    canvas.on('selection:created', (opt) => {
      const id = getAnnId(opt.selected?.[0])
      if (id) setSelectedAnnotation(id)
    })
    canvas.on('selection:updated', (opt) => {
      const id = getAnnId(opt.selected?.[0])
      if (id) setSelectedAnnotation(id)
    })
    canvas.on('selection:cleared', () => setSelectedAnnotation(null))

    canvas.on('object:modified', (opt) => {
      const obj = opt.target
      const id = getAnnId(obj)
      if (!obj || !id) return
      updateAnnotation(id, objectToPatch(obj, scale))
      checkpoint()
    })
    canvas.on('text:editing:exited', (opt) => {
      const obj = opt.target
      const id = getAnnId(obj)
      if (!obj || !id) return
      updateAnnotation(id, objectToPatch(obj, scale))
      checkpoint()
    })

    return () => {
      cancelled = true
      void canvas.dispose()
      fabricRef.current = null
    }
    // Recreate canvas when page, scale, tool or annotation set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id, scale, width, height, tool, color, annsKey, pendingImage])

  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas || !selectedAnnotationId) return
    const obj = canvas.getObjects().find((o) => getAnnId(o) === selectedAnnotationId)
    if (obj && canvas.getActiveObject() !== obj) canvas.setActiveObject(obj)
  }, [selectedAnnotationId])

  return (
    <div
      className="absolute inset-0"
      style={{ width, height, pointerEvents: interactive ? 'auto' : 'none', zIndex: 3 }}
    >
      <canvas ref={canvasEl} />
    </div>
  )
}
