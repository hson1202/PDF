import { useDocumentStore } from '@/store/documentStore'
import type { PageMeta } from '@/types'

type Props = {
  page: PageMeta
  scale: number
}

export function FormLayer({ page, scale }: Props) {
  const { formFields, setFormValue, tool, checkpoint } = useDocumentStore()
  const fields = formFields.filter((f) => f.pageId === page.id)
  const active = tool === 'form'
  if (!active && fields.length === 0) return null

  const commitValue = (id: string, value: string | boolean) => {
    setFormValue(id, value)
    checkpoint()
  }

  return (
    <div className="absolute inset-0" style={{ zIndex: 4, pointerEvents: active ? 'auto' : 'none' }}>
      {active && fields.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 text-center">
          <span className="rounded-full bg-zinc-900/85 px-3 py-1 text-xs text-white">
            Trang này không có ô form. Công cụ này chỉ điền PDF tờ khai/đơn đã có ô trống sẵn.
          </span>
        </div>
      ) : null}
      {fields.map((field) => {
        const style = {
          left: field.x * scale,
          top: field.y * scale,
          width: Math.max(16, field.width * scale),
          height: Math.max(16, field.height * scale),
          fontSize: Math.max(10, field.height * scale * 0.55),
        }
        if (field.type === 'checkbox') {
          return (
            <label
              key={field.id}
              className="absolute flex items-center justify-center bg-blue-500/15 ring-1 ring-blue-500"
              style={style}
            >
              <input
                type="checkbox"
                checked={Boolean(field.value)}
                onChange={(e) => commitValue(field.id, e.target.checked)}
              />
            </label>
          )
        }
        if (field.type === 'radio') {
          const option = field.options?.[0] ?? String(field.value ?? '')
          return (
            <label
              key={field.id}
              className="absolute flex items-center justify-center bg-blue-500/15 ring-1 ring-blue-500"
              style={style}
              title={option}
            >
              <input
                type="radio"
                name={`pdf-radio-${field.sourceId}-${field.name}`}
                value={option}
                checked={String(field.value ?? '') === option}
                onChange={() => commitValue(field.id, option)}
              />
            </label>
          )
        }
        if (field.type === 'dropdown' && field.options?.length) {
          return (
            <select
              key={field.id}
              className="absolute bg-blue-50/80 ring-1 ring-blue-500"
              style={style}
              value={String(field.value ?? '')}
              onChange={(e) => commitValue(field.id, e.target.value)}
            >
              <option value="">—</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )
        }
        return (
          <input
            key={field.id}
            className="absolute bg-blue-50/80 px-1 ring-1 ring-blue-500 outline-none"
            style={style}
            value={String(field.value ?? '')}
            onChange={(e) => setFormValue(field.id, e.target.value)}
            onBlur={() => checkpoint()}
          />
        )
      })}
    </div>
  )
}
