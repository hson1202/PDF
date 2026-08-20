import { useEffect, useMemo, useState } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from 'lucide-react'
import { APP_FONTS, FONT_GROUPS, FONT_SIZES, fontCssFamily, type FontId, type TextAlign } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { useDocumentStore } from '@/store/documentStore'
import type { TextBoxAnnotation } from '@/types'

function isTextBox(ann: { type: string }): ann is TextBoxAnnotation {
  return ann.type === 'text' || ann.type === 'sticky'
}

function ColorSwatch({
  value,
  title,
  emptyTitle,
  onChange,
}: {
  value: string
  title: string
  emptyTitle?: string
  onChange: (color: string) => void
}) {
  const empty = !value
  return (
    <label className="relative flex items-center" title={empty ? emptyTitle || title : title}>
      <span
        className={cn(
          'h-6 w-6 overflow-hidden rounded border border-zinc-300',
          empty && 'bg-[linear-gradient(45deg,#fff_25%,#d4d4d8_25%,#d4d4d8_50%,#fff_50%,#fff_75%,#d4d4d8_75%)] bg-[length:8px_8px]',
        )}
        style={empty ? undefined : { background: value }}
      >
        <input
          type="color"
          value={empty ? '#ffffff' : value}
          className="h-8 w-8 -translate-x-1 -translate-y-1 cursor-pointer opacity-0"
          onChange={(e) => onChange(e.target.value)}
        />
      </span>
      {emptyTitle ? (
        <button
          type="button"
          title="Bỏ màu nền"
          className={cn(
            'absolute -top-1 -right-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-zinc-700 text-[9px] leading-none text-white',
            !empty && 'flex',
          )}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
          }}
        >
          ×
        </button>
      ) : null}
    </label>
  )
}

export function FormatBar() {
  const {
    pages,
    tool,
    textStyle,
    annotations,
    selectedAnnotationId,
    applyTextStyle,
    setTextStyle,
  } = useDocumentStore()
  const selected = annotations.find((a) => a.id === selectedAnnotationId)
  const selectedText = selected && isTextBox(selected) ? selected : null
  const showFill = tool === 'text' || selectedText?.type === 'text'
  const visible =
    pages.length > 0 &&
    (tool === 'text' || tool === 'sticky' || tool === 'editText' || Boolean(selectedText))

  const [sizeDraft, setSizeDraft] = useState(String(Math.round(textStyle.fontSize)))
  const currentFont = useMemo(
    () => APP_FONTS.find((f) => f.id === textStyle.fontFamily),
    [textStyle.fontFamily],
  )

  useEffect(() => {
    setSizeDraft(String(Math.round(textStyle.fontSize)))
  }, [textStyle.fontSize])

  useEffect(() => {
    if (!selectedText) return
    setTextStyle({
      fontFamily: selectedText.fontFamily ?? 'helvetica',
      fontSize: selectedText.fontSize,
      color: selectedText.color,
      fillColor: selectedText.fillColor ?? '',
      bold: selectedText.bold ?? false,
      italic: selectedText.italic ?? false,
      underline: selectedText.underline ?? false,
      align: selectedText.align ?? 'left',
    })
  }, [
    selectedText?.id,
    selectedText?.fontFamily,
    selectedText?.fontSize,
    selectedText?.color,
    selectedText?.fillColor,
    selectedText?.bold,
    selectedText?.italic,
    selectedText?.underline,
    selectedText?.align,
    setTextStyle,
  ])

  if (!visible) return null

  const commitSize = () => {
    const n = Number(sizeDraft)
    if (!Number.isFinite(n)) {
      setSizeDraft(String(Math.round(textStyle.fontSize)))
      return
    }
    applyTextStyle({ fontSize: Math.min(96, Math.max(6, n)) })
  }

  const sizeValue = Math.round(textStyle.fontSize)
  const sizeOptions = FONT_SIZES.includes(sizeValue) ? FONT_SIZES : [...FONT_SIZES, sizeValue].sort((a, b) => a - b)

  return (
    <div
      data-format-bar
      className="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-zinc-200 bg-white px-3"
      onMouseDown={(e) => {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'SELECT' || tag === 'INPUT' || tag === 'OPTION') return
        e.preventDefault()
      }}
    >
      <ColorSwatch
        value={textStyle.color}
        title="Màu chữ"
        onChange={(color) => applyTextStyle({ color })}
      />
      {showFill ? (
        <ColorSwatch
          value={textStyle.fillColor}
          title="Màu nền hộp chữ"
          emptyTitle="Màu nền (trong suốt)"
          onChange={(fillColor) => applyTextStyle({ fillColor })}
        />
      ) : null}

      <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-200" />

      <select
        value={textStyle.fontFamily}
        title="Font chữ"
        className="h-7 min-w-[10.5rem] max-w-[14rem] rounded-md border border-zinc-300 bg-white px-1.5 text-xs text-zinc-800"
        style={{ fontFamily: currentFont?.cssFamily || fontCssFamily(textStyle.fontFamily) }}
        onChange={(e) => applyTextStyle({ fontFamily: e.target.value as FontId })}
      >
        {FONT_GROUPS.map((group) => (
          <optgroup key={group} label={group}>
            {APP_FONTS.filter((f) => f.group === group).map((f) => (
              <option key={f.id} value={f.id} style={{ fontFamily: f.cssFamily }}>
                {f.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <select
        value={String(sizeValue)}
        title="Cỡ chữ"
        className="h-7 w-[3.5rem] rounded-md border border-zinc-300 bg-white px-1 text-xs text-zinc-800"
        onChange={(e) => {
          const n = Number(e.target.value)
          if (n) applyTextStyle({ fontSize: n })
        }}
      >
        {sizeOptions.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>

      <input
        type="number"
        min={6}
        max={96}
        step={1}
        value={sizeDraft}
        title="Cỡ chữ tùy chỉnh"
        className="h-7 w-12 rounded-md border border-zinc-300 px-1.5 text-xs tabular-nums"
        onChange={(e) => setSizeDraft(e.target.value)}
        onBlur={commitSize}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          }
        }}
      />

      <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-200" />

      <button
        type="button"
        title="Đậm"
        onClick={() => applyTextStyle({ bold: !textStyle.bold })}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100',
          textStyle.bold && 'bg-blue-50 text-blue-700',
        )}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Nghiêng"
        onClick={() => applyTextStyle({ italic: !textStyle.italic })}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100',
          textStyle.italic && 'bg-blue-50 text-blue-700',
        )}
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Gạch chân"
        onClick={() => applyTextStyle({ underline: !textStyle.underline })}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100',
          textStyle.underline && 'bg-blue-50 text-blue-700',
        )}
      >
        <Underline className="h-3.5 w-3.5" />
      </button>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-zinc-200" />

      {(
        [
          ['left', AlignLeft, 'Căn trái'],
          ['center', AlignCenter, 'Căn giữa'],
          ['right', AlignRight, 'Căn phải'],
          ['justify', AlignJustify, 'Căn đều'],
        ] as const
      ).map(([id, Icon, title]) => (
        <button
          key={id}
          type="button"
          title={title}
          onClick={() => applyTextStyle({ align: id as TextAlign })}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100',
            textStyle.align === id && 'bg-blue-50 text-blue-700',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
