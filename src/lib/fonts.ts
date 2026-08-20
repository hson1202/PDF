export type FontId = string
export type TextAlign = 'left' | 'center' | 'right' | 'justify'
export type FontVariant = 'regular' | 'bold' | 'italic' | 'boldItalic'
export type FontGroup = 'Sans' | 'Serif' | 'Mono'

export type TextStyle = {
  fontFamily: FontId
  fontSize: number
  color: string
  fillColor: string
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  align: TextAlign
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'helvetica',
  fontSize: 18,
  color: '#111827',
  fillColor: '',
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  align: 'left',
}

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72]

type AppFont = {
  id: FontId
  label: string
  group: FontGroup
  cssFamily: string
  ttf: Partial<Record<FontVariant, string[]>>
}

const NOTO = (family: string, file: string) =>
  `https://cdn.jsdelivr.net/gh/notofonts/notofonts.github.io/fonts/${family}/full/ttf/${file}`
const OFL = (folder: string, file: string) =>
  `https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/${folder}/${file}`

const NOTO_SANS: AppFont['ttf'] = {
  regular: [NOTO('NotoSans', 'NotoSans-Regular.ttf'), '/fonts/NotoSans-Regular.ttf'],
  bold: [NOTO('NotoSans', 'NotoSans-Bold.ttf')],
  italic: [NOTO('NotoSans', 'NotoSans-Italic.ttf')],
  boldItalic: [NOTO('NotoSans', 'NotoSans-BoldItalic.ttf')],
}
const NOTO_SERIF: AppFont['ttf'] = {
  regular: [NOTO('NotoSerif', 'NotoSerif-Regular.ttf')],
  bold: [NOTO('NotoSerif', 'NotoSerif-Bold.ttf')],
  italic: [NOTO('NotoSerif', 'NotoSerif-Italic.ttf')],
  boldItalic: [NOTO('NotoSerif', 'NotoSerif-BoldItalic.ttf')],
}
const NOTO_MONO: AppFont['ttf'] = {
  regular: [NOTO('NotoSansMono', 'NotoSansMono-Regular.ttf')],
  bold: [NOTO('NotoSansMono', 'NotoSansMono-Bold.ttf')],
}
const BE_VIETNAM: AppFont['ttf'] = {
  regular: [OFL('bevietnampro', 'BeVietnamPro-Regular.ttf')],
  bold: [OFL('bevietnampro', 'BeVietnamPro-Bold.ttf')],
  italic: [OFL('bevietnampro', 'BeVietnamPro-Italic.ttf')],
  boldItalic: [OFL('bevietnampro', 'BeVietnamPro-BoldItalic.ttf')],
}
const LATO: AppFont['ttf'] = {
  regular: [OFL('lato', 'Lato-Regular.ttf')],
  bold: [OFL('lato', 'Lato-Bold.ttf')],
  italic: [OFL('lato', 'Lato-Italic.ttf')],
  boldItalic: [OFL('lato', 'Lato-BoldItalic.ttf')],
}
const MERRIWEATHER: AppFont['ttf'] = {
  regular: [OFL('merriweather', 'Merriweather-Regular.ttf')],
  bold: [OFL('merriweather', 'Merriweather-Bold.ttf')],
  italic: [OFL('merriweather', 'Merriweather-Italic.ttf')],
  boldItalic: [OFL('merriweather', 'Merriweather-BoldItalic.ttf')],
}

export const APP_FONTS: AppFont[] = [
  { id: 'helvetica', label: 'Helvetica', group: 'Sans', cssFamily: '"Noto Sans", Helvetica, Arial, sans-serif', ttf: NOTO_SANS },
  { id: 'arial', label: 'Arial', group: 'Sans', cssFamily: 'Arimo, Arial, "Noto Sans", sans-serif', ttf: NOTO_SANS },
  { id: 'roboto', label: 'Roboto', group: 'Sans', cssFamily: 'Roboto, "Noto Sans", sans-serif', ttf: NOTO_SANS },
  { id: 'openSans', label: 'Open Sans', group: 'Sans', cssFamily: '"Open Sans", "Noto Sans", sans-serif', ttf: NOTO_SANS },
  { id: 'inter', label: 'Inter', group: 'Sans', cssFamily: 'Inter, "Noto Sans", sans-serif', ttf: NOTO_SANS },
  { id: 'lato', label: 'Lato', group: 'Sans', cssFamily: 'Lato, "Noto Sans", sans-serif', ttf: LATO },
  { id: 'montserrat', label: 'Montserrat', group: 'Sans', cssFamily: 'Montserrat, "Noto Sans", sans-serif', ttf: NOTO_SANS },
  { id: 'nunito', label: 'Nunito', group: 'Sans', cssFamily: 'Nunito, "Noto Sans", sans-serif', ttf: NOTO_SANS },
  { id: 'beVietnam', label: 'Be Vietnam Pro', group: 'Sans', cssFamily: '"Be Vietnam Pro", "Noto Sans", sans-serif', ttf: BE_VIETNAM },
  { id: 'times', label: 'Times', group: 'Serif', cssFamily: '"Noto Serif", Times, serif', ttf: NOTO_SERIF },
  { id: 'timesNewRoman', label: 'Times New Roman', group: 'Serif', cssFamily: 'Tinos, "Times New Roman", "Noto Serif", serif', ttf: NOTO_SERIF },
  { id: 'georgia', label: 'Georgia', group: 'Serif', cssFamily: 'Merriweather, Georgia, "Noto Serif", serif', ttf: MERRIWEATHER },
  { id: 'lora', label: 'Lora', group: 'Serif', cssFamily: 'Lora, "Noto Serif", serif', ttf: NOTO_SERIF },
  { id: 'playfair', label: 'Playfair Display', group: 'Serif', cssFamily: '"Playfair Display", "Noto Serif", serif', ttf: NOTO_SERIF },
  { id: 'courier', label: 'Courier', group: 'Mono', cssFamily: '"Noto Sans Mono", Courier, monospace', ttf: NOTO_MONO },
  { id: 'courierNew', label: 'Courier New', group: 'Mono', cssFamily: 'Cousine, "Courier New", "Noto Sans Mono", monospace', ttf: NOTO_MONO },
  { id: 'robotoMono', label: 'Roboto Mono', group: 'Mono', cssFamily: '"Roboto Mono", "Noto Sans Mono", monospace', ttf: NOTO_MONO },
]

export const FONT_GROUPS: FontGroup[] = ['Sans', 'Serif', 'Mono']

const FONT_BY_ID = Object.fromEntries(APP_FONTS.map((f) => [f.id, f])) as Record<string, AppFont>

export function getFont(id: FontId): AppFont {
  return FONT_BY_ID[id] ?? FONT_BY_ID.helvetica
}

export function fontCssFamily(id: FontId | string | null | undefined): string {
  if (!id) return FONT_BY_ID.helvetica.cssFamily
  if (id in FONT_BY_ID) return FONT_BY_ID[id].cssFamily
  return `"${id}", "Noto Sans", sans-serif`
}

export function fontVariant(bold: boolean, italic: boolean): FontVariant {
  if (bold && italic) return 'boldItalic'
  if (bold) return 'bold'
  if (italic) return 'italic'
  return 'regular'
}

export function inferFontId(name: string | undefined): FontId {
  const s = (name || '').toLowerCase().replace(/[-_]/g, ' ')
  if (s.includes('vietnam') || s.includes('svn')) return 'beVietnam'
  if (s.includes('roboto') && s.includes('mono')) return 'robotoMono'
  if (s.includes('courier new') || s.includes('cousine') || s.includes('consolas')) return 'courierNew'
  if (s.includes('courier') || s.includes('mono')) return 'courier'
  if (s.includes('playfair')) return 'playfair'
  if (s.includes('lora')) return 'lora'
  if (s.includes('georgia') || s.includes('merriweather')) return 'georgia'
  if (s.includes('times new') || s.includes('tinos')) return 'timesNewRoman'
  if (s.includes('times') || (s.includes('serif') && !s.includes('sans'))) return 'times'
  if (s.includes('montserrat')) return 'montserrat'
  if (s.includes('nunito')) return 'nunito'
  if (s.includes('open sans') || s.includes('opensans')) return 'openSans'
  if (s.includes('inter')) return 'inter'
  if (s.includes('lato')) return 'lato'
  if (s.includes('roboto')) return 'roboto'
  if (s.includes('arial') || s.includes('arimo') || s.includes('liberation sans')) return 'arial'
  return 'helvetica'
}

export function isDefaultTextColor(color: string | undefined) {
  const c = (color || '').replace('#', '').toLowerCase()
  return c === '111827' || c === '111111' || c === '000000' || c === '111'
}

export function cssFontShorthand(
  fontId: FontId | string | null | undefined,
  sizePx: number,
  bold = false,
  italic = false,
) {
  const style = italic ? 'italic' : 'normal'
  const weight = bold ? '700' : '400'
  return `${style} ${weight} ${sizePx}px ${fontCssFamily(fontId)}`
}

let cssFontsPromise: Promise<void> | null = null

export function ensureCssFonts(): Promise<void> {
  if (cssFontsPromise) return cssFontsPromise
  cssFontsPromise = (async () => {
    if (typeof document === 'undefined' || !document.fonts) return
    await Promise.all(
      APP_FONTS.flatMap((f) => [
        document.fonts.load(`16px ${f.cssFamily}`),
        document.fonts.load(`bold 16px ${f.cssFamily}`),
        document.fonts.load(`italic 16px ${f.cssFamily}`),
        document.fonts.load(`italic bold 16px ${f.cssFamily}`),
      ]),
    )
  })()
  return cssFontsPromise
}
