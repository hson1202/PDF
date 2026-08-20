import { useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Toolbar } from '@/components/layout/Toolbar'
import { FormatBar } from '@/components/layout/FormatBar'
import { ShortcutsDialog } from '@/components/layout/ShortcutsDialog'
import { Sidebar } from '@/components/pages/Sidebar'
import { PdfViewer } from '@/components/viewer/PdfViewer'
import { SignatureDialog } from '@/components/tools/SignatureDialog'
import { Toaster } from '@/components/ui/toast'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useDocumentStore } from '@/store/documentStore'

function ToolHint() {
  const { tool, annotations, selectedAnnotationId, formFields } = useDocumentStore()
  const text =
    tool === 'select'
      ? selectedAnnotationId
        ? 'Kéo để di chuyển · góc để đổi size · Delete để xóa'
        : annotations.length === 0
          ? 'Chọn dùng để kéo/xóa thứ bạn đã thêm. Chưa có gì — hãy highlight, thêm chữ hoặc ảnh trước.'
          : 'Bấm vào highlight, chữ, ảnh, chữ ký đã thêm để kéo hoặc xóa. Không chọn được chữ gốc trên PDF.'
      : tool === 'editText'
        ? 'Bấm vào chữ gốc trên PDF để sửa · đổi font trên thanh format · Enter lưu · Esc hủy'
        : tool === 'highlight'
          ? 'Bôi đen chữ để tô màu · double-click để tô một từ'
          : tool === 'underline'
            ? 'Bôi đen chữ để gạch chân · double-click để gạch một từ'
            : tool === 'form'
              ? formFields.length
                ? 'Bấm vào ô xanh trên PDF để điền'
                : 'PDF này không có ô form sẵn'
              : tool === 'draw'
                ? 'Giữ chuột và vẽ trên trang'
                : tool === 'text'
                  ? 'Bấm vào trang để chèn hộp chữ · đổi font / cỡ / đậm trên thanh format'
                  : tool === 'sticky'
                    ? 'Bấm vào trang để dán ghi chú'
                    : null
  if (!text) return null
  return (
    <div className="pointer-events-none absolute top-3 left-1/2 z-20 max-w-[min(92%,36rem)] -translate-x-1/2 rounded-full bg-zinc-900 px-3 py-1 text-center text-xs text-white">
      {text}
    </div>
  )
}

export default function App() {
  const [helpOpen, setHelpOpen] = useState(false)
  const { pages, pendingImage } = useDocumentStore()

  useKeyboardShortcuts({
    helpOpen,
    toggleHelp: () => setHelpOpen((v) => !v),
    closeHelp: () => setHelpOpen(false),
  })

  return (
    <div className="flex h-full flex-col">
      <Header onOpenShortcuts={() => setHelpOpen(true)} />
      <FormatBar />
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        {pages.length > 0 && <Sidebar />}
        <main className="relative min-w-0 flex-1">
          {pendingImage && (
            <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-full bg-zinc-900 px-3 py-1 text-xs text-white">
              Bấm vào trang PDF để đặt ảnh/chữ ký
            </div>
          )}
          {!pendingImage && pages.length > 0 ? <ToolHint /> : null}
          <PdfViewer />
        </main>
      </div>
      <SignatureDialog />
      <ShortcutsDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <Toaster />
    </div>
  )
}
