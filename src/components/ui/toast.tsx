import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts, dismiss } = useToastStore()
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto rounded-lg px-3 py-2 text-left text-sm text-white shadow-lg',
            t.type === 'error' && 'bg-red-600',
            t.type === 'success' && 'bg-emerald-600',
            t.type === 'info' && 'bg-zinc-800',
          )}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
