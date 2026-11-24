import type { AidMap } from '../types'

export interface Unmatched {
  row: number
  label: string
  kg: number
}

export interface UploadResult {
  aid: AidMap
  unmatched: Unmatched[]
  totalKg: number
  rowsUsed: number
  unit: 'кг' | 'т'
}

export function parseNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string') return null
  const s = v.replace(/\s/g, '').replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null
}

/** Простой парсер CSV: разделитель ; табуляция или , (что чаще в первой строке), кавычки по RFC 4180. */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^\u{feff}/u, '')
  const first = src.split(/\r?\n/, 1)[0] ?? ''
  const count = (ch: string) => first.split(ch).length - 1
  const delim = [';', '\t', ','].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ';')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === delim) {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const REGION_HEADER = /регион|субъект|область|территор|region|name|назван/i
const KG_HEADER = /кг|kg|вес|объ[её]м|масса|тонн|weight|volume|amount|^т$|,\s*т$|\(т\)/i
const TONNES = /тонн|^т$|,\s*т$|\(т\)|tonn/i
const TOTAL = /^(итого|всего|total|россия|рф|российская федерация)(\s|$|[:.,])/i

export function rowsToAid(rows: unknown[][], match: (s: unknown) => string | null): UploadResult {
  const clean = rows.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''))
  if (!clean.length) throw new Error('Файл пуст: нужны строки «регион; кг».')

  let start = 0
  let regionCol = -1
  let kgCol = -1
  let factor = 1
  const headerIdx = clean.slice(0, 10).findIndex((r) => r.some((c) => REGION_HEADER.test(String(c ?? ''))) && r.some((c) => KG_HEADER.test(String(c ?? ''))))
  if (headerIdx >= 0) {
    const h = clean[headerIdx].map((c) => String(c ?? ''))
    regionCol = h.findIndex((c) => REGION_HEADER.test(c))
    kgCol = h.findIndex((c, i) => i !== regionCol && KG_HEADER.test(c))
    factor = TONNES.test(h[kgCol]) ? 1000 : 1
    start = headerIdx + 1
  } else {
    const probe = clean[0]
    regionCol = probe.findIndex((c) => match(c) !== null)
    kgCol = probe.findIndex((c, i) => i !== regionCol && parseNumber(c) !== null)
  }
  if (regionCol < 0 || kgCol < 0) throw new Error('Не нашёл колонки «регион» и «кг». Скачайте шаблон и сравните заголовки.')

  const aid: AidMap = {}
  const unmatched: Unmatched[] = []
  let totalKg = 0
  let rowsUsed = 0
  for (let i = start; i < clean.length; i++) {
    const label = String(clean[i][regionCol] ?? '').trim()
    const n = parseNumber(clean[i][kgCol])
    if (n === null || !label) continue
    const kg = n * factor
    const iso = match(label)
    if (iso) {
      aid[iso] = (aid[iso] ?? 0) + kg
      totalKg += kg
      rowsUsed++
    } else if (!TOTAL.test(label)) unmatched.push({ row: i + 1, label, kg })
  }
  return { aid, unmatched, totalKg, rowsUsed, unit: factor === 1000 ? 'т' : 'кг' }
}

/** Читает CSV (UTF-8 или Windows-1251) или XLSX целиком в браузере: файл никуда не отправляется. */
export async function parseFile(file: File, match: (s: unknown) => string | null): Promise<UploadResult> {
  const buf = await file.arrayBuffer()
  if (/\.(xlsx|xls|ods)$/i.test(file.name)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    return rowsToAid(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true }), match)
  }
  let text = new TextDecoder('utf-8').decode(buf)
  if (text.includes('\u{fffd}')) text = new TextDecoder('windows-1251').decode(buf)
  return rowsToAid(parseCsvText(text), match)
}
