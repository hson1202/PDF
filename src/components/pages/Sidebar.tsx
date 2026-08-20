import { useRef } from 'react'
import { RotateCw, Trash2, FilePlus2, Scissors } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDocumentStore } from '@/store/documentStore'
import { Thumbnail } from '@/components/pages/Thumbnail'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const mergeRef = useRef<HTMLInputElement>(null)
  const {
    pages,
    currentPageIndex,
    selectedPageIds,
    formFields,
    setCurrentPage,
    togglePageSelected,
    rotatePages,
    deletePages,
    movePage,
    mergePdf,
    download,
  } = useDocumentStore()

  const onDrop = (from: number, to: number) => {
    movePage(from, to)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Trang ({pages.length})
      </div>
      <div className="thumb-scroll flex-1 space-y-2 overflow-y-auto p-2">
        {pages.map((page, index) => (
          <Thumbnail
            key={page.id}
            page={page}
            index={index}
            active={index === currentPageIndex}
            selected={selectedPageIds.includes(page.id)}
            onClick={() => {
              setCurrentPage(index)
              document.getElementById(`page-${page.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            onToggleSelect={() => togglePageSelected(page.id)}
            onDrop={onDrop}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1 border-t border-zinc-200 p-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pages.length === 0}
          onClick={() => rotatePages()}
          title="Xoay trang đang chọn 90° theo chiều kim đồng hồ"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Xoay
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pages.length === 0}
          onClick={() => deletePages()}
          title="Xóa các trang đang chọn"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Xóa
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mergeRef.current?.click()}
          title="Gộp thêm file PDF vào cuối tài liệu"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          Gộp
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pages.length === 0}
          onClick={() => void download(selectedPageIds.length ? selectedPageIds : [pages[currentPageIndex].id])}
          title="Tách và tải riêng các trang đang chọn"
        >
          <Scissors className="h-3.5 w-3.5" />
          Tách
        </Button>
      </div>
      {formFields.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-t border-zinc-200 p-2">
          <div className="mb-1 text-xs font-semibold text-zinc-500">Form fields</div>
          {formFields.map((f) => (
            <button
              key={f.id}
              type="button"
              className={cn('mb-1 block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-white')}
              onClick={() => {
                const idx = pages.findIndex((p) => p.id === f.pageId)
                if (idx >= 0) {
                  setCurrentPage(idx)
                  document.getElementById(`page-${f.pageId}`)?.scrollIntoView({ behavior: 'smooth' })
                }
              }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      <input
        ref={mergeRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void mergePdf(file)
          e.target.value = ''
        }}
      />
    </aside>
  )
}
