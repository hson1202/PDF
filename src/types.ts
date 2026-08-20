import type { FontId, TextAlign } from '@/lib/fonts'

export type Tool =
  | 'select'
  | 'editText'
  | 'highlight'
  | 'underline'
  | 'draw'
  | 'text'
  | 'sticky'
  | 'image'
  | 'signature'
  | 'form'

export type { FontId, TextAlign }

export type ZoomFitMode = 'fitWidth' | 'fitPage' | 'actual'

export type SourceDoc = {
  id: string
  name: string
  bytes: Uint8Array
}

export type PageMeta = {
  id: string
  sourceId: string
  sourcePageIndex: number
  rotation: number
  width: number
  height: number
}

export type Point = { x: number; y: number }

export type AnnotationBase = {
  id: string
  pageId: string
}

export type HighlightAnnotation = AnnotationBase & {
  type: 'highlight' | 'underline'
  x: number
  y: number
  width: number
  height: number
  color: string
}

export type DrawAnnotation = AnnotationBase & {
  type: 'draw'
  points: Point[]
  color: string
  strokeWidth: number
}

export type TextBoxAnnotation = AnnotationBase & {
  type: 'text' | 'sticky'
  x: number
  y: number
  width: number
  height: number
  text: string
  fontSize: number
  color: string
  fontFamily: FontId
  bold: boolean
  italic: boolean
  underline: boolean
  align: TextAlign
  fillColor?: string
}

export type ImageAnnotation = AnnotationBase & {
  type: 'image' | 'signature'
  x: number
  y: number
  width: number
  height: number
  dataUrl: string
}

export type Annotation =
  | HighlightAnnotation
  | DrawAnnotation
  | TextBoxAnnotation
  | ImageAnnotation

export type TextReplacement = {
  id: string
  key: string
  pageId: string
  x: number
  y: number
  width: number
  height: number
  oldText: string
  newText: string
  fontSize: number
  origFontSize: number
  fontFamily: string
  fontId: FontId | null
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  ascent: number
}

export type EditingNativeText = {
  id: string
  key: string
  pageId: string
  x: number
  y: number
  width: number
  height: number
  oldText: string
  origFontSize: number
  fontFamily: string
  ascent: number
  draft: string
}

export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown'

export type FormFieldMeta = {
  id: string
  pageId: string
  sourceId: string
  name: string
  type: FormFieldType
  x: number
  y: number
  width: number
  height: number
  options?: string[]
  value: string | boolean
}

export type HistorySnapshot = {
  pages: PageMeta[]
  annotations: Annotation[]
  textReplacements: TextReplacement[]
  formFields: FormFieldMeta[]
}

export type TextItemBox = {
  id: string
  key: string
  str: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  ascent: number
}
