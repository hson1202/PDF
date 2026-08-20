import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type DialogProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Dialog({ open, title, onClose, children, footer, className }: DialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={cn('w-full max-w-lg rounded-xl bg-white shadow-xl', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button className="text-zinc-500 hover:text-zinc-800" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-zinc-200 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  )
}
