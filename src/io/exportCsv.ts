type Cell = string | number

/** CSV для русского Excel: BOM, разделитель «;», десятичная запятая. */
export function toCsv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (typeof v === 'number') return String(v).replace('.', ',')
    return /[;"\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
  }
  return '\u{feff}' + rows.map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n'
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
