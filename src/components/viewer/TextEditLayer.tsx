import { useEffect, useMemo, useRef, useState } from 'react'
import { usePageTextBoxes } from '@/hooks/usePageTextBoxes'
import { useDocumentStore } from '@/store/documentStore'
import { fontCssFamily, inferFontId } from '@/lib/fonts'
import type { PageMeta, TextItemBox, TextReplacement } from '@/types'
import { uid } from '@/lib/utils'

type Props = {
  page: PageMeta
  scale: number
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

function coverPad(box: { fontSize: number }) {
  return {
    x: Math.max(1.2, box.fontSize * 0.07),
    y: Math.max(0.8, box.fontSize * 0.1),
  }
}

export function TextEditLayer({ page, scale }: Props) {
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
  const inputRef = useRef<HTMLInputElement>(null)
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
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
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
      ascent: box.ascent,
    }
    upsertTextReplacement(repl)
    if (editingRef.current === box.id) {
      setEditing(null)
      setEditingNativeText(null)
    }
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
    },
    text: string,
    opts?: { onClick?: () => void; canRevert?: TextReplacement },
  ) => {
    const pad = coverPad(geom)
    const fontH = geom.fontSize
    const boxW = Math.max(geom.width, (text.length || 1) * fontH * 0.58)
    const boxH = Math.max(geom.height, fontH * 1.18)
    const left = (geom.x - pad.x) * scale
    const top = (geom.y - pad.y) * scale
    const width = (boxW + pad.x * 2) * scale
    const height = (boxH + pad.y * 2) * scale
    const fontSize = fontH * scale
    const family = geom.fontId ? fontCssFamily(geom.fontId) : `${geom.fontFamily || 'Noto Sans'}, "Noto Sans", Inter, sans-serif`
    return (
      <div
        className="group absolute"
        style={{ left, top, width, height, zIndex: 6 }}
        onClick={opts?.onClick}
      >
        <div className="absolute inset-0 bg-white" />
        <span
          className="absolute block overflow-visible whitespace-pre"
          style={{
            left: pad.x * scale,
            top: pad.y * scale,
            height: boxH * scale,
            fontSize,
            lineHeight: 1,
            fontFamily: family,
            fontWeight: geom.bold ? 700 : 400,
            fontStyle: geom.italic ? 'italic' : 'normal',
            textDecoration: geom.underline ? 'underline' : 'none',
            color: geom.color || '#111',
          }}
        >
          {text}
        </span>
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
        <div key={r.id}>{renderCover(r, r.newText)}</div>
      ))}

      {painted.rows.map(({ box, existing }) => {
        const isEditing = editing === box.id
        const text = existing?.newText ?? box.str
        const pad = coverPad(box)

        if (isEditing) {
          const left = (box.x - pad.x) * scale
          const top = (box.y - pad.y) * scale
          const fontSize = textStyle.fontSize * scale
          const coverH = Math.max((box.height + pad.y * 2) * scale, fontSize + pad.y * 2 * scale)
          const minW = (box.width + pad.x * 2) * scale
          const grow = Math.max(minW, draft.length * fontSize * 0.62 + pad.x * 2 * scale)
          return (
            <div key={box.id} className="absolute" style={{ left, top, height: coverH, width: grow, zIndex: 8 }}>
              <div className="absolute inset-0 bg-white" />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => {
                  const v = e.target.value
                  setDraft(v)
                  const cur = useDocumentStore.getState().editingNativeText
                  if (cur) setEditingNativeText({ ...cur, draft: v })
                }}
                className="text-edit-input absolute"
                style={{
                  left: pad.x * scale,
                  top: pad.y * scale,
                  width: `calc(100% - ${pad.x * scale}px)`,
                  height: fontSize,
                  fontSize,
                  lineHeight: 1,
                  fontFamily: fontCssFamily(textStyle.fontFamily),
                  fontWeight: textStyle.bold ? 700 : 400,
                  fontStyle: textStyle.italic ? 'italic' : 'normal',
                  textDecoration: textStyle.underline ? 'underline' : 'none',
                  color: textStyle.color,
                }}
                onBlur={(e) => {
                  const next = e.relatedTarget as HTMLElement | null
                  if (next?.closest('[data-format-bar]')) return
                  window.setTimeout(() => {
                    if (document.activeElement?.closest('[data-format-bar]')) return
                    commitEdit(box, existing, (e.target as HTMLInputElement).value)
                  }, 0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    setEditing(null)
                    setEditingNativeText(null)
                  }
                }}
              />
            </div>
          )
        }

        if (existing) {
          return (
            <div key={box.id}>
              {renderCover(existing, existing.newText, {
                onClick: active
                  ? () => startEdit(box, existing)
                  : undefined,
                canRevert: existing,
              })}
            </div>
          )
        }

        if (!active) return null

        return (
          <div
            key={box.id}
            className="text-edit-hit absolute cursor-text"
            style={{
              left: (box.x - pad.x) * scale,
              top: (box.y - pad.y) * scale,
              width: Math.max((box.width + pad.x * 2) * scale, 8),
              height: Math.max((box.height + pad.y * 2) * scale, 10),
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
