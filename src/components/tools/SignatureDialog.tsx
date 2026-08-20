import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDocumentStore } from '@/store/documentStore'

export function SignatureDialog() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const { signatureOpen, setSignatureOpen, setPendingImage } = useDocumentStore()
  const [blank, setBlank] = useState(true)

  useEffect(() => {
    if (!signatureOpen) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    setBlank(true)
  }, [signatureOpen])

  const pos = (e: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - r.left) / r.width) * canvas.width,
      y: ((e.clientY - r.top) / r.height) * canvas.height,
    }
  }

  return (
    <Dialog
      open={signatureOpen}
      title="Vẽ chữ ký"
      onClose={() => setSignatureOpen(false)}
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              const canvas = canvasRef.current
              const ctx = canvas?.getContext('2d')
              if (!canvas || !ctx) return
              ctx.clearRect(0, 0, canvas.width, canvas.height)
              ctx.strokeStyle = '#111827'
              ctx.lineWidth = 2.4
              ctx.lineCap = 'round'
              setBlank(true)
            }}
          >
            Xóa
          </Button>
          <Button
            disabled={blank}
            onClick={() => {
              const canvas = canvasRef.current
              if (!canvas) return
              setPendingImage({ dataUrl: canvas.toDataURL('image/png'), kind: 'signature' })
              setSignatureOpen(false)
            }}
          >
            Dùng chữ ký
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-zinc-500">Vẽ chữ ký bằng chuột hoặc bút cảm ứng, rồi chèn vào trang PDF.</p>
      <canvas
        ref={canvasRef}
        width={520}
        height={200}
        className="w-full cursor-crosshair rounded-md border border-zinc-300 bg-white"
        onPointerDown={(e) => {
          drawing.current = true
          const ctx = canvasRef.current?.getContext('2d')
          if (!ctx) return
          const p = pos(e)
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ;(e.target as HTMLCanvasElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return
          const ctx = canvasRef.current?.getContext('2d')
          if (!ctx) return
          const p = pos(e)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
          setBlank(false)
        }}
        onPointerUp={() => {
          drawing.current = false
        }}
      />
    </Dialog>
  )
}
