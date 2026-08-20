import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { usePageTextBoxes } from '@/hooks/usePageTextBoxes'
import { useDocumentStore } from '@/store/documentStore'
import { cssFontShorthand, fontCssFamily, inferFontId } from '@/lib/fonts'
import { fitFontSize, measureCssTextWidth, sampleBackground, tightCover } from '@/lib/pdf/textCover'
import type { PageMeta, TextItemBox, TextReplacement } from '@/types'
import { uid } from '@/lib/utils'

type Props = {
  page: PageMeta
  scale: number
  canvasRef?: RefObject<HTMLCanvasElement | null>
  paintGen?: number
}

function overlapScore(a: { x: number; y: number; width: number; height: number }, b: TextItemBox) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  const inter = x * y
  if (inter <= 0) return 0
  return inter / Math.min(a.width * a.height, b.width * b.height)
}

function findReplacement(list: TextReplacement[], box: TextItemBox) {
  const exact = list.find((r) => r.key === box.key)
  if (exact) return exact
  let best: TextReplacement | undefined
  let score = 0.45
  for (const r of list) {
    const s = overlapScore(r, box)
    if (s > score) {
      score = s
      best = r
    }
  }
  return best
}

/** Tính textDecoration kết hợp underline + strikethrough */
function textDecorationCss(underline?: boolean, strikethrough?: boolean) {
  const parts: string[] = []
  if (underline) parts.push('underline')
  if (strikethrough) parts.push('line-through')
  return parts.length ? parts.join(' ') : 'none'
}

export function TextEditLayer({ page, scale, canvasRef, paintGen = 0 }: Props) {
  const {
    tool,
    textStyle,
    textReplacements,
    upsertTextReplacement,
    removeTextReplacement,
    setTextStyle,
    setEditingNativeText,
  } = useDocumentStore()
  const { boxes, ready } = usePageTextBoxes(page)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editingRef = useRef<string | null>(null)
  const active = tool === 'editText'
  const pageRepls = useMemo(
    () => textReplacements.filter((t) => t.pageId === page.id),
    [textReplacements, page.id],
  )

  editingRef.current = editing

  useEffect(() => {
    if (!active) {
      setEditing(null)
      setEditingNativeText(null)
    }
  }, [active, setEditingNativeText])

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [editing])

  const painted = useMemo(() => {
    const used = new Set<string>()
    const rows = boxes
      .map((box) => {
        const existing = findReplacement(pageRepls, box)
        if (existing) used.add(existing.id)
        return { box, existing }
      })
      .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height)

    const orphans = pageRepls.filter((r) => !used.has(r.id))
    return { rows, orphans }
  }, [boxes, pageRepls])

  const bgById = useMemo(() => {
    void paintGen
    const canvas = canvasRef?.current
    const map = new Map<string, string>()
    for (const r of pageRepls) {
      map.set(r.id, sampleBackground(canvas, tightCover(r), page.width, page.height))
    }
    return map
  }, [pageRepls, canvasRef, paintGen, page.width, page.height])

  const commitEdit = (box: TextItemBox, existing: TextReplacement | undefined, next: string) => {
    const repl: TextReplacement = {
      id: existing?.id ?? uid(),
      key: box.key,
      pageId: page.id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      oldText: box.str,
      newText: next,
      fontSize: textStyle.fontSize,
      origFontSize: existing?.origFontSize ?? box.fontSize,
      fontFamily: box.fontFamily,
      fontId: textStyle.fontFamily,
      color: textStyle.color,
      bold: textStyle.bold,
      italic: textStyle.italic,
      underline: textStyle.underline,
      strikethrough: textStyle.strikethrough,
      ascent: box.ascent,
    }
    upsertTextReplacement(repl)
    // Luôn clear state bất kể race condition với editingRef
    setEditing(null)
    setEditingNativeText(null)
  }

  const startEdit = (box: TextItemBox, existing: TextReplacement | undefined) => {
    const fontId = existing?.fontId ?? inferFontId(box.fontFamily)
    setTextStyle({
      fontFamily: fontId,
      fontSize: existing?.fontSize ?? box.fontSize,
      color: existing?.color ?? '#111827',
      fillColor: '',
      bold: existing?.bold ?? false,
      italic: existing?.italic ?? false,
      underline: existing?.underline ?? false,
      strikethrough: existing?.strikethrough ?? false,
      align: 'left',
    })
    setEditingNativeText({
      id: existing?.id ?? uid(),
      key: box.key,
      pageId: page.id,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      oldText: box.str,
      origFontSize: existing?.origFontSize ?? box.fontSize,
      fontFamily: box.fontFamily,
      ascent: box.ascent,
      draft: existing?.newText ?? box.str,
    })
    setDraft(existing?.newText ?? box.str)
    setEditing(box.id)
  }

  const renderCover = (
    geom: {
      id?: string
      x: number
      y: number
      width: number
      height: number
      fontSize: number
      fontFamily?: string
      fontId?: TextReplacement['fontId']
      color?: string
      bold?: boolean
      italic?: boolean
      underline?: boolean
      strikethrough?: boolean
    },
    text: string,
    opts?: { onClick?: () => void; canRevert?: TextReplacement; bg?: string },
  ) => {
    const cover = tightCover(geom)
    const left = cover.x * scale
    const top = cover.y * scale
    const width = cover.width * scale
    const height = cover.height * scale
    const family = geom.fontId
      ? fontCssFamily(geom.fontId)
      : `${geom.fontFamily || 'Noto Sans'}, "Noto Sans", Inter, sans-serif`
    const fontCss = cssFontShorthand(geom.fontId || inferFontId(geom.fontFamily), geom.fontSize, geom.bold, geom.italic)
    const fitted = fitFontSize(measureCssTextWidth(text, fontCss), geom.fontSize, geom.width)
    const fontSize = fitted * scale
    const bg = opts?.bg || (geom.id ? bgById.get(geom.id) : undefined) || sampleBackground(
      canvasRef?.current,
      cover,
      page.width,
      page.height,
    )
    return (
      <div
        className="group absolute"
        style={{ left, top, width, height, zIndex: 6 }}
        onClick={opts?.onClick}
      >
        <div className="absolute inset-0 overflow-hidden" style={{ background: bg }}>
          <span
            className="absolute block overflow-hidden whitespace-pre"
            style={{
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              fontSize,
              lineHeight: 1,
              fontFamily: family,
              fontWeight: geom.bold ? 700 : 400,
              fontStyle: geom.italic ? 'italic' : 'normal',
              textDecoration: textDecorationCss(geom.underline, geom.strikethrough),
              color: geom.color || '#111',
            }}
          >
            {text}
          </span>
        </div>
        {opts?.canRevert && active ? (
          <button
            type="button"
            title="Hoàn tác chữ này"
            className="absolute -top-2 -right-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[10px] leading-none text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
            onClick={(e) => {
              e.stopPropagation()
              removeTextReplacement(opts.canRevert!.id)
            }}
          >
            ×
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="absolute inset-0" style={{ zIndex: 5, pointerEvents: active ? 'auto' : 'none' }}>
      {painted.orphans.map((r) => (
        <div key={r.id}>{renderCover(r, r.newText, { bg: bgById.get(r.id) })}</div>
      ))}

      {painted.rows.map(({ box, existing }) => {
        const isEditing = editing === box.id
        const text = existing?.newText ?? box.str

        if (isEditing) {
          const cover = tightCover(box)
          const left = cover.x * scale
          const top = cover.y * scale
          const width = cover.width * scale
          const fontCss = cssFontShorthand(textStyle.fontFamily, textStyle.fontSize, textStyle.bold, textStyle.italic)
          const fitted = fitFontSize(measureCssTextWidth(draft, fontCss), textStyle.fontSize, box.width)
          const fontSize = fitted * scale
          const bg =
            (existing ? bgById.get(existing.id) : undefined) ||
            sampleBackground(canvasRef?.current, cover, page.width, page.height)

          // Tính chiều cao tối thiểu từ box gốc, nhưng textarea tự mở rộng theo nội dung
          const minHeight = cover.height * scale

          return (
            <div
              key={box.id}
              className="absolute overflow-visible"
              style={{ left, top, width, zIndex: 8 }}
            >
              <textarea
                ref={textareaRef}
                value={draft}
                rows={1}
                onChange={(e) => {
                  const v = e.target.value
                  setDraft(v)
                  const cur = useDocumentStore.getState().editingNativeText
                  if (cur) setEditingNativeText({ ...cur, draft: v })
                  // Auto-resize: reset rồi set scrollHeight để expand
                  const el = e.target as HTMLTextAreaElement
                  el.style.height = `${minHeight}px`
                  el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`
                }}
                className="text-edit-input absolute left-0 top-0 w-full"
                style={{
                  minHeight,
                  height: minHeight,
                  fontSize,
                  lineHeight: 1.3,
                  fontFamily: fontCssFamily(textStyle.fontFamily),
                  fontWeight: textStyle.bold ? 700 : 400,
                  fontStyle: textStyle.italic ? 'italic' : 'normal',
                  textDecoration: textDecorationCss(textStyle.underline, textStyle.strikethrough),
                  color: textStyle.color,
                  background: bg,
                  boxShadow: 'inset 0 0 0 1px #3b82f6, 0 2px 8px rgba(59,130,246,0.15)',
                  resize: 'none',
                  overflow: 'hidden',
                  padding: 0,
                  border: 'none',
                  outline: 'none',
                }}
                onBlur={(e) => {
                  // Capture value ngay lập tức trước khi vào setTimeout (async-safe)
                  const committedValue = (e.target as HTMLTextAreaElement).value
                  const next = e.relatedTarget as HTMLElement | null
                  if (next?.closest('[data-format-bar]')) return
                  window.setTimeout(() => {
                    if (document.activeElement?.closest('[data-format-bar]')) return
                    commitEdit(box, existing, committedValue)
                  }, 0)
                }}
                onKeyDown={(e) => {
                  // Ctrl+Enter hoặc Escape → commit/cancel
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLTextAreaElement).blur()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setEditing(null)
                    setEditingNativeText(null)
                  }
                }}
              />
              {/* Hint: Enter xuống dòng, Ctrl+Enter xác nhận */}
              <span
                className="pointer-events-none absolute left-0 whitespace-nowrap rounded-b bg-blue-600 px-1.5 py-0.5 text-[9px] leading-none text-white opacity-80"
                style={{ top: '100%', zIndex: 9 }}
              >
                Enter ↵ · Ctrl+Enter ✓ · Esc ✕
              </span>
            </div>
          )
        }

        if (existing) {
          return (
            <div key={box.id}>
              {renderCover(existing, existing.newText, {
                onClick: active ? () => startEdit(box, existing) : undefined,
                canRevert: existing,
                bg: bgById.get(existing.id),
              })}
            </div>
          )
        }

        if (!active) return null

        const hit = tightCover(box)
        return (
          <div
            key={box.id}
            className="text-edit-hit absolute cursor-text"
            style={{
              left: hit.x * scale,
              top: hit.y * scale,
              width: Math.max(hit.width * scale, 8),
              height: Math.max(hit.height * scale, 10),
            }}
            title={text}
            onClick={() => startEdit(box, existing)}
          />
        )
      })}

      {active && ready && boxes.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
          <span className="rounded-full bg-zinc-900/85 px-3 py-1 text-xs text-white">
            Không tìm thấy chữ có thể sửa (PDF scan hoặc chỉ có ảnh)
          </span>
        </div>
      ) : null}
    </div>
  )
}
