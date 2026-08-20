import { useRef } from 'react'
import {
  Download,
  FolderOpen,
  Keyboard,
  Maximize,
  Minus,
  Plus,
  Redo2,
  Undo2,
  LoaderCircle,
  UnfoldHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentStore } from '@/store/documentStore'
import { applyFitZoom } from '@/lib/zoom'

type Props = {
  onOpenShortcuts: () => void
}

export function Header({ onOpenShortcuts }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const {
    fileName,
    pages,
    zoom,
    zoomMode,
    loading,
    exporting,
    historyIndex,
    history,
    openPdf,
    setZoom,
    undo,
    redo,
    download,
  } = useDocumentStore()
  const hasDoc = pages.length > 0

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-zinc-200 bg-white px-3">
      <div className="flex items-center gap-2 pr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
          PDF
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">PDF Editor</div>
          <div className="max-w-[180px] truncate text-xs text-zinc-500">
            {fileName || 'Chưa mở tệp'}
          </div>
        </div>
      </div>

      <input
        id="open-pdf-input"
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void openPdf(file)
          e.target.value = ''
        }}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileRef.current?.click()}
        title="Mở file PDF từ máy tính (Ctrl+O)"
      >
        <FolderOpen className="h-4 w-4" />
        Mở PDF
      </Button>

      <div className="mx-1 h-6 w-px shrink-0 bg-zinc-200" />

      <Button
        variant="ghost"
        size="iconSm"
        disabled={historyIndex <= 0}
        onClick={undo}
        title="Hoàn tác thao tác vừa làm (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="iconSm"
        disabled={historyIndex >= history.length - 1}
        onClick={redo}
        title="Làm lại thao tác đã hoàn tác (Ctrl+Y)"
      >
        <Redo2 className="h-4 w-4" />
      </Button>

      <div className="mx-1 h-6 w-px shrink-0 bg-zinc-200" />

      <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
        <Button
          variant="ghost"
          size="iconSm"
          disabled={!hasDoc}
          onClick={() => setZoom(zoom - 0.1)}
          title="Thu nhỏ trang (Ctrl+−)"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <button
          type="button"
          disabled={!hasDoc}
          onClick={() => applyFitZoom('actual')}
          title="Kích thước thực 100% — không phóng, không thu (Ctrl+0)"
          className="w-12 text-center text-xs tabular-nums text-zinc-700 hover:text-blue-700 disabled:opacity-40"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Button
          variant="ghost"
          size="iconSm"
          disabled={!hasDoc}
          onClick={() => setZoom(zoom + 0.1)}
          title="Phóng to trang (Ctrl++)"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Button
        variant={zoomMode === 'fitWidth' ? 'default' : 'outline'}
        size="sm"
        disabled={!hasDoc}
        onClick={() => applyFitZoom('fitWidth')}
        title="Vừa chiều rộng — căn trang theo chiều ngang cửa sổ, cuộn dọc để xem hết (Ctrl+2)"
      >
        <UnfoldHorizontal className="h-4 w-4" />
        Vừa rộng
      </Button>
      <Button
        variant={zoomMode === 'fitPage' ? 'default' : 'outline'}
        size="sm"
        disabled={!hasDoc}
        onClick={() => applyFitZoom('fitPage')}
        title="Vừa toàn trang — thu/phóng để cả trang vừa khít cửa sổ (Ctrl+1)"
      >
        <Maximize className="h-4 w-4" />
        Vừa trang
      </Button>
      <Button
        variant={zoomMode === 'actual' ? 'default' : 'outline'}
        size="sm"
        disabled={!hasDoc}
        onClick={() => applyFitZoom('actual')}
        title="Kích thước thực — hiển thị 100%, không tự căn (Ctrl+0)"
      >
        100%
      </Button>

      <div className="ml-auto flex items-center gap-2">
        {(loading || exporting) && <LoaderCircle className="h-4 w-4 animate-spin text-blue-600" />}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenShortcuts}
          title="Xem danh sách phím tắt (?)"
        >
          <Keyboard className="h-4 w-4" />
          Phím tắt
        </Button>
        <Button
          size="sm"
          disabled={!hasDoc || exporting}
          onClick={() => void download()}
          title="Tải file PDF đã chỉnh xuống máy (Ctrl+S)"
        >
          <Download className="h-4 w-4" />
          Tải xuống
        </Button>
      </div>
    </header>
  )
}
