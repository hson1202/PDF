import { create } from 'zustand'
import { saveAs } from 'file-saver'
import type {
  Annotation,
  EditingNativeText,
  FormFieldMeta,
  HistorySnapshot,
  PageMeta,
  SourceDoc,
  TextBoxAnnotation,
  TextReplacement,
  Tool,
  ZoomFitMode,
} from '@/types'
import { uid } from '@/lib/utils'
import { DEFAULT_TEXT_STYLE, inferFontId, isDefaultTextColor, type TextStyle } from '@/lib/fonts'
import { clearPdfjsCache, loadPdfjsDocument } from '@/lib/pdf/pdfjs'
import { extractFormFields } from '@/lib/pdf/extract'
import { buildPdfBytes } from '@/lib/pdf/export'
import { useToastStore } from '@/store/toastStore'

const MAX_HISTORY = 50

type DocumentState = {
  fileName: string
  sources: SourceDoc[]
  pages: PageMeta[]
  currentPageIndex: number
  selectedPageIds: string[]
  zoom: number
  zoomMode: ZoomFitMode | 'manual'
  tool: Tool
  color: string
  strokeWidth: number
  textStyle: TextStyle
  annotations: Annotation[]
  selectedAnnotationId: string | null
  editingNativeText: EditingNativeText | null
  textReplacements: TextReplacement[]
  formFields: FormFieldMeta[]
  loading: boolean
  exporting: boolean
  history: HistorySnapshot[]
  historyIndex: number
  signatureOpen: boolean
  pendingImage: { dataUrl: string; kind: 'image' | 'signature' } | null
}

type DocumentActions = {
  setTool: (tool: Tool) => void
  setColor: (color: string) => void
  setTextStyle: (patch: Partial<TextStyle>) => void
  applyTextStyle: (patch: Partial<TextStyle>) => void
  setEditingNativeText: (editing: EditingNativeText | null) => void
  setZoom: (zoom: number) => void
  setZoomFit: (mode: ZoomFitMode, zoom: number) => void
  setCurrentPage: (index: number) => void
  togglePageSelected: (pageId: string) => void
  clearPageSelection: () => void
  openPdf: (file: File) => Promise<void>
  mergePdf: (file: File) => Promise<void>
  rotatePages: (pageIds?: string[], delta?: number) => void
  deletePages: (pageIds?: string[]) => void
  movePage: (from: number, to: number) => void
  addAnnotation: (ann: Annotation) => void
  addAnnotations: (anns: Annotation[]) => void
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void
  removeAnnotation: (id: string) => void
  setSelectedAnnotation: (id: string | null) => void
  upsertTextReplacement: (repl: TextReplacement) => void
  removeTextReplacement: (id: string) => void
  setFormValue: (id: string, value: string | boolean) => void
  setSignatureOpen: (open: boolean) => void
  setPendingImage: (img: { dataUrl: string; kind: 'image' | 'signature' } | null) => void
  placePendingImage: (pageId: string, x: number, y: number) => void
  checkpoint: () => void
  undo: () => void
  redo: () => void
  download: (pageIds?: string[]) => Promise<void>
  reset: () => void
}

function snapshotOf(s: Pick<DocumentState, 'pages' | 'annotations' | 'textReplacements' | 'formFields'>): HistorySnapshot {
  return structuredClone({
    pages: s.pages,
    annotations: s.annotations,
    textReplacements: s.textReplacements,
    formFields: s.formFields,
  })
}

function applySnapshot(snap: HistorySnapshot): Partial<DocumentState> {
  return {
    pages: snap.pages,
    annotations: snap.annotations,
    textReplacements: snap.textReplacements,
    formFields: snap.formFields,
    selectedAnnotationId: null,
    editingNativeText: null,
  }
}

function isIdentityReplacement(repl: TextReplacement) {
  const inferred = inferFontId(repl.fontFamily)
  const fontUnchanged = !repl.fontId || repl.fontId === inferred
  return (
    repl.newText === repl.oldText &&
    fontUnchanged &&
    Math.abs(repl.fontSize - (repl.origFontSize || repl.fontSize)) < 0.05 &&
    isDefaultTextColor(repl.color) &&
    !repl.bold &&
    !repl.italic &&
    !repl.underline
  )
}

function sameReplacement(a: TextReplacement, b: TextReplacement) {
  return (
    a.newText === b.newText &&
    a.fontId === b.fontId &&
    Math.abs(a.fontSize - b.fontSize) < 0.01 &&
    a.color === b.color &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline
  )
}

function isTextBox(ann: Annotation): ann is TextBoxAnnotation {
  return ann.type === 'text' || ann.type === 'sticky'
}

const initial: DocumentState = {
  fileName: '',
  sources: [],
  pages: [],
  currentPageIndex: 0,
  selectedPageIds: [],
  zoom: 1.1,
  zoomMode: 'manual',
  tool: 'select',
  color: '#facc15',
  strokeWidth: 2,
  textStyle: { ...DEFAULT_TEXT_STYLE },
  annotations: [],
  selectedAnnotationId: null,
  editingNativeText: null,
  textReplacements: [],
  formFields: [],
  loading: false,
  exporting: false,
  history: [],
  historyIndex: -1,
  signatureOpen: false,
  pendingImage: null,
}

export const useDocumentStore = create<DocumentState & DocumentActions>((set, get) => {
  const toast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    useToastStore.getState().show(message, type)
  }

  const commit = (
    partial: Partial<DocumentState> | ((s: DocumentState) => Partial<DocumentState>),
  ) => {
    set((s) => {
      const p = typeof partial === 'function' ? partial(s) : partial
      const snap = snapshotOf({
        pages: p.pages ?? s.pages,
        annotations: p.annotations ?? s.annotations,
        textReplacements: p.textReplacements ?? s.textReplacements,
        formFields: p.formFields ?? s.formFields,
      })
      const next = s.history.slice(0, s.historyIndex + 1)
      next.push(snap)
      if (next.length > MAX_HISTORY) next.shift()
      return { ...p, history: next, historyIndex: next.length - 1 }
    })
  }

  return {
    ...initial,

    setTool: (tool) =>
      set({
        tool,
        selectedAnnotationId: tool === 'select' || tool === 'text' || tool === 'sticky'
          ? get().selectedAnnotationId
          : null,
        editingNativeText: tool === 'editText' ? get().editingNativeText : null,
      }),
    setColor: (color) => set({ color }),
    setTextStyle: (patch) => set((s) => ({ textStyle: { ...s.textStyle, ...patch } })),
    setEditingNativeText: (editing) => set({ editingNativeText: editing }),
    applyTextStyle: (patch) => {
      const s = get()
      const style = { ...s.textStyle, ...patch }
      set({ textStyle: style })

      const ann = s.annotations.find((a) => a.id === s.selectedAnnotationId)
      if (ann && isTextBox(ann)) {
        commit({
          annotations: s.annotations.map((a) =>
            a.id === ann.id
              ? {
                  ...a,
                  fontFamily: style.fontFamily,
                  fontSize: style.fontSize,
                  color: style.color,
                  fillColor: style.fillColor,
                  bold: style.bold,
                  italic: style.italic,
                  underline: style.underline,
                  align: style.align,
                }
              : a,
          ),
        })
        return
      }

      const native = s.editingNativeText
      if (!native) return

      const existing = s.textReplacements.find((t) => t.id === native.id || t.key === native.key)
      const repl: TextReplacement = {
        id: existing?.id ?? native.id,
        key: native.key,
        pageId: native.pageId,
        x: native.x,
        y: native.y,
        width: native.width,
        height: native.height,
        oldText: native.oldText,
        newText: native.draft ?? existing?.newText ?? native.oldText,
        fontSize: style.fontSize,
        origFontSize: native.origFontSize,
        fontFamily: native.fontFamily,
        fontId: style.fontFamily,
        color: style.color,
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        ascent: native.ascent,
      }
      get().upsertTextReplacement(repl)
    },
    setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.4, zoom)), zoomMode: 'manual' }),
    setZoomFit: (mode, zoom) => {
      const z = Math.min(3, Math.max(0.4, zoom))
      const s = get()
      if (s.zoomMode === mode && Math.abs(s.zoom - z) < 0.002) return
      set({ zoom: z, zoomMode: mode })
    },
    setCurrentPage: (index) => {
      const { pages } = get()
      if (pages.length === 0) return
      set({ currentPageIndex: Math.min(Math.max(0, index), pages.length - 1) })
    },
    togglePageSelected: (pageId) =>
      set((s) => ({
        selectedPageIds: s.selectedPageIds.includes(pageId)
          ? s.selectedPageIds.filter((id) => id !== pageId)
          : [...s.selectedPageIds, pageId],
      })),
    clearPageSelection: () => set({ selectedPageIds: [] }),

    openPdf: async (file) => {
      set({ loading: true })
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const sourceId = uid()
        clearPdfjsCache()
        const pdf = await loadPdfjsDocument(sourceId, bytes)
        const pages: PageMeta[] = []
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1)
          const viewport = page.getViewport({ scale: 1 })
          pages.push({
            id: uid(),
            sourceId,
            sourcePageIndex: i,
            rotation: 0,
            width: viewport.width,
            height: viewport.height,
          })
        }
        const formFields = await extractFormFields(pdf, pages, sourceId)
        const snap = snapshotOf({ pages, annotations: [], textReplacements: [], formFields })
        set({
          fileName: file.name,
          sources: [{ id: sourceId, name: file.name, bytes }],
          pages,
          formFields,
          annotations: [],
          textReplacements: [],
          currentPageIndex: 0,
          selectedPageIds: [],
          selectedAnnotationId: null,
          editingNativeText: null,
          tool: 'select',
          history: [snap],
          historyIndex: 0,
          pendingImage: null,
        })
        toast(`Đã mở ${file.name} (${pages.length} trang)`, 'success')
      } catch {
        toast('Không thể đọc file PDF', 'error')
      } finally {
        set({ loading: false })
      }
    },

    mergePdf: async (file) => {
      if (get().pages.length === 0) {
        await get().openPdf(file)
        return
      }
      set({ loading: true })
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const sourceId = uid()
        const pdf = await loadPdfjsDocument(sourceId, bytes)
        const newPages: PageMeta[] = []
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1)
          const viewport = page.getViewport({ scale: 1 })
          newPages.push({
            id: uid(),
            sourceId,
            sourcePageIndex: i,
            rotation: 0,
            width: viewport.width,
            height: viewport.height,
          })
        }
        const formFields = await extractFormFields(pdf, newPages, sourceId)
        commit((s) => ({
          sources: [...s.sources, { id: sourceId, name: file.name, bytes }],
          pages: [...s.pages, ...newPages],
          formFields: [...s.formFields, ...formFields],
        }))
        toast(`Đã gộp ${file.name} (+${newPages.length} trang)`, 'success')
      } catch {
        toast('Không thể gộp file PDF này', 'error')
      } finally {
        set({ loading: false })
      }
    },

    rotatePages: (pageIds, delta = 90) => {
      const { pages, selectedPageIds, currentPageIndex } = get()
      const ids = pageIds?.length
        ? pageIds
        : selectedPageIds.length
          ? selectedPageIds
          : [pages[currentPageIndex]?.id]
      if (!ids[0]) return
      commit((s) => ({
        pages: s.pages.map((p) =>
          ids.includes(p.id) ? { ...p, rotation: (p.rotation + delta) % 360 } : p,
        ),
      }))
    },

    deletePages: (pageIds) => {
      const { pages, selectedPageIds, currentPageIndex } = get()
      const ids = new Set(
        pageIds?.length ? pageIds : selectedPageIds.length ? selectedPageIds : [pages[currentPageIndex]?.id],
      )
      if (ids.size === 0) return
      if (ids.size >= pages.length) {
        toast('Không thể xóa tất cả các trang', 'error')
        return
      }
      commit((s) => {
        const nextPages = s.pages.filter((p) => !ids.has(p.id))
        const nextIndex = Math.min(s.currentPageIndex, nextPages.length - 1)
        return {
          pages: nextPages,
          currentPageIndex: Math.max(0, nextIndex),
          selectedPageIds: [],
          annotations: s.annotations.filter((a) => !ids.has(a.pageId)),
          textReplacements: s.textReplacements.filter((t) => !ids.has(t.pageId)),
          formFields: s.formFields.filter((f) => !ids.has(f.pageId)),
        }
      })
    },

    movePage: (from, to) => {
      if (from === to) return
      commit((s) => {
        const pages = [...s.pages]
        const [item] = pages.splice(from, 1)
        pages.splice(to, 0, item)
        return { pages, currentPageIndex: to }
      })
    },

    addAnnotation: (ann) => {
      get().addAnnotations([ann])
    },
    addAnnotations: (anns) => {
      if (anns.length === 0) return
      commit((s) => ({
        annotations: [...s.annotations, ...anns],
        selectedAnnotationId: anns[anns.length - 1].id,
      }))
    },
    updateAnnotation: (id, patch) => {
      set((s) => ({
        annotations: s.annotations.map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a)),
      }))
    },
    removeAnnotation: (id) => {
      commit((s) => ({
        annotations: s.annotations.filter((a) => a.id !== id),
        selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
      }))
    },
    setSelectedAnnotation: (id) => set({ selectedAnnotationId: id }),

    upsertTextReplacement: (repl) => {
      const current = get().textReplacements
      const existing = current.find((t) => t.id === repl.id || t.key === repl.key)
      if (isIdentityReplacement(repl)) {
        if (!existing) return
        commit((s) => ({
          textReplacements: s.textReplacements.filter((t) => t.id !== existing.id && t.key !== repl.key),
        }))
        return
      }
      if (existing && sameReplacement(existing, { ...existing, ...repl })) return
      commit((s) => {
        const idx = s.textReplacements.findIndex((t) => t.id === repl.id || t.key === repl.key)
        const next = [...s.textReplacements]
        if (idx >= 0) next[idx] = { ...next[idx], ...repl, id: next[idx].id }
        else next.push(repl)
        return { textReplacements: next }
      })
    },
    removeTextReplacement: (id) => {
      commit((s) => ({
        textReplacements: s.textReplacements.filter((t) => t.id !== id),
      }))
    },

    setFormValue: (id, value) => {
      set((s) => {
        const target = s.formFields.find((f) => f.id === id)
        if (target?.type === 'radio') {
          return {
            formFields: s.formFields.map((f) =>
              f.name === target.name && f.sourceId === target.sourceId ? { ...f, value } : f,
            ),
          }
        }
        return {
          formFields: s.formFields.map((f) => (f.id === id ? { ...f, value } : f)),
        }
      })
    },

    setSignatureOpen: (open) => set({ signatureOpen: open }),
    setPendingImage: (img) => set({ pendingImage: img, tool: img ? 'image' : get().tool }),

    checkpoint: () => {
      const s = get()
      const snap = snapshotOf(s)
      const last = s.history[s.historyIndex]
      if (last && JSON.stringify(last) === JSON.stringify(snap)) return
      commit({})
    },

    placePendingImage: (pageId, x, y) => {
      const pending = get().pendingImage
      if (!pending) return
      const isSign = pending.kind === 'signature'
      const width = isSign ? 180 : 160
      const height = isSign ? 70 : 100
      commit((s) => ({
        annotations: [
          ...s.annotations,
          {
            id: uid(),
            pageId,
            type: pending.kind,
            x: x - width / 2,
            y: y - height / 2,
            width,
            height,
            dataUrl: pending.dataUrl,
          },
        ],
        pendingImage: null,
        tool: 'select' as const,
      }))
      toast(isSign ? 'Đã chèn chữ ký. Kéo để chỉnh vị trí.' : 'Đã chèn ảnh. Kéo để chỉnh vị trí.', 'success')
    },

    undo: () => {
      const { history, historyIndex } = get()
      if (historyIndex <= 0) return
      const nextIndex = historyIndex - 1
      set({ ...applySnapshot(history[nextIndex]), historyIndex: nextIndex })
    },
    redo: () => {
      const { history, historyIndex } = get()
      if (historyIndex >= history.length - 1) return
      const nextIndex = historyIndex + 1
      set({ ...applySnapshot(history[nextIndex]), historyIndex: nextIndex })
    },

    download: async (pageIds) => {
      const s = get()
      if (s.pages.length === 0) return
      const native = s.editingNativeText
      if (native) {
        get().upsertTextReplacement({
          id: native.id,
          key: native.key,
          pageId: native.pageId,
          x: native.x,
          y: native.y,
          width: native.width,
          height: native.height,
          oldText: native.oldText,
          newText: native.draft,
          fontSize: s.textStyle.fontSize,
          origFontSize: native.origFontSize,
          fontFamily: native.fontFamily,
          fontId: s.textStyle.fontFamily,
          color: s.textStyle.color,
          bold: s.textStyle.bold,
          italic: s.textStyle.italic,
          underline: s.textStyle.underline,
          ascent: native.ascent,
        })
      }
      set({ exporting: true })
      try {
        const latest = get()
        const bytes = await buildPdfBytes(
          {
            sources: latest.sources,
            pages: latest.pages,
            annotations: latest.annotations,
            textReplacements: latest.textReplacements,
            formFields: latest.formFields,
          },
          pageIds,
        )
        const copy = new Uint8Array(bytes.byteLength)
        copy.set(bytes)
        const blob = new Blob([copy.buffer], { type: 'application/pdf' })
        const name = pageIds?.length
          ? latest.fileName.replace(/\.pdf$/i, '') + '-split.pdf'
          : latest.fileName || 'document.pdf'
        saveAs(blob, name)
        toast('Đã tải file PDF', 'success')
      } catch {
        toast('Không thể xuất file PDF', 'error')
      } finally {
        set({ exporting: false })
      }
    },

    reset: () => {
      clearPdfjsCache()
      set({ ...initial })
    },
  }
})
