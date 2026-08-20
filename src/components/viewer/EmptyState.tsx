import { useDocumentStore } from '@/store/documentStore'

export function EmptyState() {
  const openPdf = useDocumentStore((s) => s.openPdf)

  return (
    <div
      className="flex h-full items-center justify-center p-8"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
        const file = [...e.dataTransfer.files].find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'))
        if (file) void openPdf(file)
      }}
    >
      <label className="flex w-full max-w-lg cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-zinc-300 bg-white px-8 py-16 text-center hover:border-blue-400 hover:bg-blue-50/40">
        <div className="mb-3 text-4xl">📄</div>
        <div className="text-lg font-semibold">Kéo thả file PDF vào đây</div>
        <div className="mt-1 text-sm text-zinc-500">hoặc bấm để chọn tệp từ máy tính (Ctrl+O)</div>
        <div className="mt-3 text-xs text-zinc-400">Bấm ? để xem phím tắt</div>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void openPdf(file)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}
