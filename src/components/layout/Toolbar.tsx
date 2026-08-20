import {
  Highlighter,
  ImagePlus,
  MousePointer2,
  Palette,
  Pencil,
  PenLine,
  SquarePen,
  StickyNote,
  Type,
  Underline,
  TextCursorInput,
} from 'lucide-react'
import { cn, fileToDataUrl } from '@/lib/utils'
import { TOOL_SHORTCUTS } from '@/lib/shortcuts'
import { useDocumentStore } from '@/store/documentStore'
import { useToastStore } from '@/store/toastStore'
import type { Tool } from '@/types'
import { useRef } from 'react'

const tools: { id: Tool; label: string; hint: string; icon: typeof MousePointer2 }[] = [
  { id: 'select', label: 'Chọn', hint: 'Kéo / xóa highlight, chữ, ảnh, chữ ký đã thêm', icon: MousePointer2 },
  { id: 'editText', label: 'Sửa chữ', hint: 'Bấm vào chữ gốc trên PDF để sửa', icon: Type },
  { id: 'highlight', label: 'Highlight', hint: 'Bôi đen chữ để tô màu', icon: Highlighter },
  { id: 'underline', label: 'Gạch chân', hint: 'Bôi đen chữ để gạch chân', icon: Underline },
  { id: 'draw', label: 'Vẽ', hint: 'Vẽ tay lên trang', icon: Pencil },
  { id: 'text', label: 'Thêm chữ', hint: 'Chèn hộp chữ mới', icon: SquarePen },
  { id: 'sticky', label: 'Ghi chú', hint: 'Dán ghi chú vàng', icon: StickyNote },
  { id: 'image', label: 'Chèn ảnh', hint: 'Chèn ảnh PNG/JPG', icon: ImagePlus },
  { id: 'signature', label: 'Chữ ký', hint: 'Vẽ hoặc chèn chữ ký', icon: PenLine },
  { id: 'form', label: 'Điền form', hint: 'Điền ô trống có sẵn trong PDF tờ khai', icon: TextCursorInput },
]

const colors = ['#facc15', '#fb7185', '#fb923c', '#60a5fa', '#4ade80', '#111827']

export function Toolbar() {
  const imageRef = useRef<HTMLInputElement>(null)
  const { tool, color, setTool, setColor, setSignatureOpen, setPendingImage, pages, formFields } =
    useDocumentStore()
  const hasForm = formFields.length > 0

  return (
    <aside className="flex w-[4.75rem] flex-col items-center gap-0.5 overflow-y-auto border-r border-zinc-200 bg-white py-2">
      {tools.map((t) => {
        const Icon = t.icon
        const shortcut = TOOL_SHORTCUTS[t.id]
        const formLocked = t.id === 'form' && !hasForm
        return (
          <button
            key={t.id}
            type="button"
            title={
              formLocked
                ? 'PDF này không có ô form sẵn (chỉ dùng với tờ khai/đơn có ô trống)'
                : `${t.label} — ${t.hint}${shortcut ? ` (${shortcut})` : ''}`
            }
            disabled={pages.length === 0}
            onClick={() => {
              if (t.id === 'signature') {
                setSignatureOpen(true)
                return
              }
              if (t.id === 'image') {
                imageRef.current?.click()
                return
              }
              if (t.id === 'form' && !hasForm) {
                useToastStore.getState().show(
                  'PDF này không có ô form sẵn. Điền form chỉ dùng với file tờ khai, đơn, phiếu đã có ô trống.',
                  'info',
                )
                return
              }
              setTool(t.id)
            }}
            className={cn(
              'relative flex w-[4.25rem] flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40',
              tool === t.id && 'bg-blue-50 text-blue-700',
              formLocked && pages.length > 0 && 'opacity-40',
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-center text-[10px] leading-tight font-medium">{t.label}</span>
            {t.id === 'form' && hasForm ? (
              <span className="absolute top-0.5 right-1 rounded-full bg-blue-600 px-1 text-[9px] leading-4 text-white">
                {formFields.length}
              </span>
            ) : null}
          </button>
        )
      })}

      <input
        id="image-file-input"
        ref={imageRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          void fileToDataUrl(file).then((dataUrl) => setPendingImage({ dataUrl, kind: 'image' }))
          e.target.value = ''
        }}
      />

      <div className="mt-2 flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-medium text-zinc-400">Màu</span>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title="Màu có sẵn"
            onClick={() => setColor(c)}
            className={cn(
              'h-5 w-5 rounded-full border border-black/10',
              color === c && 'ring-2 ring-blue-500 ring-offset-1',
            )}
            style={{ background: c }}
          />
        ))}
        <label
          title="Tự trộn màu — chọn bất kỳ màu nào"
          className={cn(
            'relative mt-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full',
            !colors.includes(color.toLowerCase()) && 'ring-2 ring-blue-500 ring-offset-1',
          )}
          style={{
            background:
              'conic-gradient(#f87171, #facc15, #4ade80, #22d3ee, #60a5fa, #c084fc, #f472b6, #f87171)',
          }}
        >
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full border border-white/80"
            style={{ background: color }}
          >
            <Palette className="h-2.5 w-2.5 text-white drop-shadow" />
          </span>
          <input
            type="color"
            value={color}
            title="Tự trộn màu"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={(e) => setColor(e.target.value.toLowerCase())}
          />
        </label>
        <span className="text-[9px] leading-tight font-medium text-zinc-400">Trộn</span>
      </div>
    </aside>
  )
}
