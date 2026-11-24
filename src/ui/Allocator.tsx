import { useMemo, useState } from 'react'
import type { AidMap, Region, Strategy } from '../types'
import { allocate, STRATEGIES, summarize } from '../model/allocate'
import { fmtInt, fmtKg, fmtRub, times } from '../format'
import { downloadText, toCsv } from '../io/exportCsv'

interface Props {
  regions: Region[]
  aid: AidMap
  usingUpload: boolean
  pricePerKg: number
  coef: number
  rub: number
  setRub: (n: number) => void
  strategy: Strategy
  setStrategy: (s: Strategy) => void
  onSelect: (iso: string) => void
}

const PRESETS = [1e6, 10e6, 50e6]
const ORDER: Strategy[] = ['current', 'need', 'equalize']

export function Allocator(p: Props) {
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState(fmtInt(p.rub))
  const byIso = useMemo(() => new Map(p.regions.map((r) => [r.iso, r])), [p.regions])
  const results = useMemo(() => {
    const opts = { pricePerKg: p.pricePerKg, coef: p.coef, baseAid: p.aid, currentWeights: p.usingUpload ? p.aid : undefined }
    return Object.fromEntries(ORDER.map((s) => [s, allocate(p.regions, p.rub, s, opts)])) as Record<Strategy, ReturnType<typeof allocate>>
  }, [p.regions, p.rub, p.pricePerKg, p.coef, p.aid, p.usingUpload])
  const sums = Object.fromEntries(ORDER.map((s) => [s, summarize(results[s])])) as Record<Strategy, ReturnType<typeof summarize>>
  const best = Math.max(...ORDER.map((s) => sums[s].lifted), 1e-9)
  const rows = results[p.strategy].filter((r) => r.rub > 0).sort((a, b) => b.rub - a.rub)
  const shown = showAll ? rows : rows.slice(0, 10)
  const ratio = sums.current.lifted > 0 ? sums[p.strategy].lifted / sums.current.lifted : 0

  const commit = (text: string) => {
    const n = Number(text.replace(/[^0-9]/g, ''))
    p.setRub(Number.isFinite(n) ? n : 0)
    setDraft(fmtInt(Number.isFinite(n) ? n : 0))
  }

  const exportCsv = () => {
    const header = ['Регион', 'ISO', 'Стратегия', 'Сумма, ₽', 'Продукты, кг', 'Снижение числа малоимущих (оценка МГУ)']
    const body = results[p.strategy].map((r) => [byIso.get(r.iso)!.short, r.iso, STRATEGIES[p.strategy].title, Math.round(r.rub), Math.round(r.kg), Math.round(r.lifted)])
    downloadText('raspredelenie-' + p.strategy + '-' + Math.round(p.rub) + '.csv', toCsv([header, ...body]))
  }

  return (
    <div className="allocator">
      <div className="alloc-controls">
        <label className="field">
          <span>Сумма помощи</span>
          <span className="money">
            <input
              inputMode="numeric"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
              aria-describedby="alloc-hint"
              aria-label="Сумма помощи в рублях"
              style={{ width: Math.max(4, draft.length + 0.6) + 'ch' }}
            />
            <span>₽</span>
          </span>
        </label>
        <div className="presets" role="group" aria-label="Готовые суммы">
          {PRESETS.map((n) => (
            <button key={n} className={'chip' + (n === p.rub ? ' is-on' : '')} onClick={() => commit(String(n))}>
              {fmtRub(n)}
            </button>
          ))}
        </div>
        <p id="alloc-hint" className="muted small">
          Например, нецелевые пожертвования через сайт фонда или софинансирование от партнёра. Цена 1 кг продуктов учитывает местные цены.
        </p>
      </div>

      {p.rub <= 0 ? (
        <p className="empty">Введите сумму, чтобы сравнить три способа распределения.</p>
      ) : (
        <>
          <div className="compare" role="radiogroup" aria-label="Способ распределения">
            {ORDER.map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={p.strategy === s}
                className={'compare-row' + (p.strategy === s ? ' is-on' : '')}
                onClick={() => p.setStrategy(s)}
              >
                <span className="compare-name">
                  <b>{STRATEGIES[s].title}</b>
                  <span className="muted">{STRATEGIES[s].hint}</span>
                </span>
                <span className="compare-bar" aria-hidden="true">
                  <i style={{ width: (sums[s].lifted / best) * 100 + '%' }} />
                </span>
                <span className="compare-value">
                  <span>
                    <b>{fmtInt(sums[s].lifted)}</b> чел.
                  </span>
                  <span className="muted small">
                    {fmtKg(sums[s].kg)}, {sums[s].regions} рег.
                  </span>
                </span>
              </button>
            ))}
          </div>
          <p className="verdict">
            {p.strategy === 'current'
              ? 'Так помощь распределяется сейчас. Выберите другой способ, чтобы сравнить.'
              : '«' + STRATEGIES[p.strategy].title + '» даёт ' + times(ratio) + ' больше снижения бедности, чем «Как сейчас», при той же сумме.'}{' '}
            <span className="muted">
              Число людей — оценка по коэффициенту исследования фонда и МГУ: это связь, а не гарантия, но для сравнения вариантов между собой она подходит.
            </span>
          </p>

          <div className="table-wrap">
            <table>
              <caption className="sr-only">Распределение суммы по регионам</caption>
              <thead>
                <tr>
                  <th scope="col">Регион</th>
                  <th scope="col" className="num">Сумма</th>
                  <th scope="col" className="num">Продукты</th>
                  <th scope="col" className="num">Снижение бедности, чел.</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.iso}>
                    <th scope="row">
                      <button className="link-btn" onClick={() => p.onSelect(r.iso)}>
                        {byIso.get(r.iso)!.short}
                      </button>
                    </th>
                    <td className="num">{fmtRub(r.rub)}</td>
                    <td className="num">{fmtKg(r.kg)}</td>
                    <td className="num">{fmtInt(r.lifted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row-actions">
            {rows.length > 10 && (
              <button className="btn-ghost" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Свернуть' : 'Показать все ' + rows.length + ' регионов'}
              </button>
            )}
            <button className="btn" onClick={exportCsv}>
              Скачать CSV
            </button>
          </div>
        </>
      )}
    </div>
  )
}
