import { useRef, useState } from 'react'
import type { AidMap, Region } from '../types'
import { parseFile, type UploadResult } from '../io/parseUpload'
import { downloadText, toCsv } from '../io/exportCsv'
import { fmtKg, fmtInt, plural } from '../format'

interface Props {
  regions: Region[]
  match: (s: unknown) => string | null
  activeName: string | null
  onApply: (aid: AidMap, name: string) => void
  onReset: () => void
}

export function Upload({ regions, match, activeName, onApply, onReset }: Props) {
  const [res, setRes] = useState<UploadResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [name, setName] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const handle = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const r = await parseFile(file, match)
      if (!r.rowsUsed) throw new Error('В файле не нашлось ни одного распознанного региона с числом килограммов.')
      setRes(r)
      setName(file.name)
      onApply(r.aid, file.name)
    } catch (e) {
      setRes(null)
      setError(e instanceof Error ? e.message : 'Не удалось прочитать файл.')
    }
  }

  const assign = (idx: number, iso: string) => {
    if (!res || !iso) return
    const u = res.unmatched[idx]
    const aid = { ...res.aid, [iso]: (res.aid[iso] ?? 0) + u.kg }
    const next: UploadResult = { ...res, aid, unmatched: res.unmatched.filter((_, i) => i !== idx), totalKg: res.totalKg + u.kg, rowsUsed: res.rowsUsed + 1 }
    setRes(next)
    onApply(next.aid, name)
  }

  /** Реальные объёмы из пресс-релизов X5 за 1 полугодие 2025: показать, как работает загрузка, без своего файла */
  const sample = () => {
    const aid: AidMap = {}
    for (const r of regions) for (const f of r.facts) aid[r.iso] = (aid[r.iso] ?? 0) + f.kg
    setRes(null)
    setError(null)
    onApply(aid, 'пресс-релизы X5 о «Корзине доброты» и фудшеринге, 1 полугодие 2025')
  }

  const template = () =>
    downloadText('shablon-vygruzki.csv', toCsv([['Регион', 'Кг за год'], ...regions.map((r) => [r.name.replace(/\s+/g, ' '), ''])]))

  const regionsWithData = res ? Object.keys(res.aid).length : 0

  return (
    <div className="upload">
      <div
        className={'drop' + (drag ? ' is-drag' : '')}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          handle(e.dataTransfer.files[0])
        }}
      >
        <p>
          <b>Перетащите файл сюда</b> или{' '}
          <button className="link-btn" onClick={() => input.current?.click()}>
            выберите на компьютере
          </button>
        </p>
        <p className="muted small">
          CSV или Excel: колонка с регионом (название, код ISO или ОКАТО, можно город-центр) и колонка с килограммами или тоннами за год. Файл читается
          только в вашем браузере и никуда не отправляется.
        </p>
        <input ref={input} type="file" accept=".csv,.txt,.xlsx,.xls,.ods" hidden onChange={(e) => handle(e.target.files?.[0])} />
        <div className="row-actions">
          <button className="btn-ghost" onClick={template}>
            Скачать шаблон
          </button>
          <button className="btn-ghost" onClick={sample}>
            Попробовать на данных пресс-релизов X5
          </button>
        </div>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {!res && activeName && (
        <div className="upload-result" role="status">
          <p>
            Сейчас карта считается по данным «{activeName}»: {regions.filter((r) => r.facts.length).length} регионов, где X5 публиковала объёмы
            помощи. Остальные регионы на карте выглядят как «помощи нет»: в пресс-релизах о них ничего не сказано.
          </p>
          <button className="btn-ghost" onClick={onReset}>
            Вернуться к модели
          </button>
        </div>
      )}

      {res && activeName && (
        <div className="upload-result" role="status">
          <p>
            Из файла «{activeName}» взяты {fmtInt(res.rowsUsed)} {plural(res.rowsUsed, ['строка', 'строки', 'строк'])}: {regionsWithData}{' '}
            {plural(regionsWithData, ['регион', 'региона', 'регионов'])}, {fmtKg(res.totalKg)}. Карта и расчёты выше теперь используют эти данные.
          </p>
          {res.unmatched.length > 0 && (
            <div className="unmatched">
              <p>
                Не распознано {res.unmatched.length} {plural(res.unmatched.length, ['строка', 'строки', 'строк'])}. Укажите регион вручную или оставьте
                как есть: эти строки в расчёт не попали.
              </p>
              <ul>
                {res.unmatched.slice(0, 20).map((u, i) => (
                  <li key={u.row + u.label}>
                    <span>
                      строка {u.row}: «{u.label}», {fmtKg(u.kg)}
                    </span>
                    <select defaultValue="" onChange={(e) => assign(i, e.target.value)} aria-label={'Регион для «' + u.label + '»'}>
                      <option value="">выбрать регион</option>
                      {regions.map((r) => (
                        <option key={r.iso} value={r.iso}>
                          {r.short}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            className="btn-ghost"
            onClick={() => {
              setRes(null)
              onReset()
            }}
          >
            Вернуться к модели
          </button>
        </div>
      )}
    </div>
  )
}
