import type { ReactNode } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { SHORTCUT_GROUPS } from '@/lib/shortcuts'

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-sans text-[11px] font-medium text-zinc-700 shadow-[0_1px_0_#d4d4d8]">
      {children}
    </kbd>
  )
}

type Props = {
  open: boolean
  onClose: () => void
}

export function ShortcutsDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} title="Phím tắt" onClose={onClose} className="max-w-2xl">
      <p className="mb-4 text-sm text-zinc-500">
        Dùng phím tắt để phóng to, thu nhỏ, căn trang và đổi công cụ nhanh hơn.
      </p>
      <div className="grid max-h-[min(70vh,520px)] gap-5 overflow-y-auto sm:grid-cols-2">
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
              {group.title}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li key={item.keys} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="text-zinc-800">{item.label}</div>
                    {item.hint ? <div className="text-[11px] text-zinc-500">{item.hint}</div> : null}
                  </div>
                  <Kbd>{item.keys}</Kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
