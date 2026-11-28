import { useMemo, useState } from 'react'
import type { AidMap, Region, Strategy } from '../types'
import { allocate, STRATEGIES, summarize, toCertificates } from '../model/allocate'
import { fmtInt, fmtKg, fmtRub, times } from '../format'
import { downloadText, toCsv } from '../io/exportCsv'
import { useHashParam } from './useHashState'

type Mode = 'sets' | 'certs'
/** 6 000 сертификатов на 15 млн ₽ за первый год «Корзины доброты» с РКК */
const CERT_NOMINAL = 2500
const CERT_SOURCE = 'https://asi.org.ru/report/2026/11/12/rkk-i-fond-x5-vyruchaem-podveli-itogi-pervogo-goda-akczii-korzina-dobroty/'

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
  const [modeStr, setMode] = useHashParam('m', 'sets')
  const mode: Mode = modeStr === 'certs' ? 'certs' : 'sets'
  const [nomStr, setNomStr] = useHashParam('nom', String(CERT_NOMINAL))
  const nominal = Math.max(100, Number(nomStr) || CERT_NOMINAL)
  const [nomDraft, setNomDraft] = useState(fmtInt(nominal))
  const byIso = useMemo(() => new Map(p.regions.map((r) => [r.iso, r])), [p.regions])
  const results = useMemo(() => {
    const opts = { pricePerKg: p.pricePerKg, coef: p.coef, baseAid: p.aid, currentWeights: p.usingUpload ? p.aid : undefined, onlyWithStores: mode === 'certs' }
    return Object.fromEntries(ORDER.map((s) => [s, allocate(p.regions, p.rub, s, opts)])) as Record<Strategy, ReturnType<typeof allocate>>
  }, [p.regions, p.rub, p.pricePerKg, p.coef, p.aid, p.usingUpload, mode])
  const certs = useMemo(
    () => (mode === 'certs' ? (Object.fromEntries(ORDER.map((s) => [s, toCertificates(results[s], nominal)])) as Record<Strategy, Record<string, number>>) : null),
    [mode, results, nominal],
  )
  const certTotal = (s: Strategy) => (certs ? Object.values(certs[s]).reduce((a, b) => a + b, 0) : 0)
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

  const commitNominal = (text: string) => {
    const n = Math.max(100, Number(text.replace(/[^0-9]/g, '')) || CERT_NOMINAL)
    setNomStr(String(n))
    setNomDraft(fmtInt(n))
  }

  const exportCsv = () => {
    const header = ['Регион', 'ISO', 'Стратегия', 'Сумма, ₽', ...(certs ? ['Сертификатов по ' + nominal + ' ₽'] : []), 'Продукты, кг', 'Снижение числа малоимущих (оценка МГУ)']
    const body = results[p.strategy].map((r) => [
      byIso.get(r.iso)!.short,
      r.iso,
      STRATEGIES[p.strategy].title,
      Math.round(r.rub),
      ...(certs ? [certs[p.strategy][r.iso] ?? 0] : []),
      Math.round(r.kg),
      Math.round(r.lifted),
    ])
    downloadText((certs ? 'sertifikaty-' : 'raspredelenie-') + p.strategy + '-' + Math.round(p.rub) + '.csv', toCsv([header, ...body]))
  }

  return (
    <div className="allocator">
      <div className="alloc-mode" role="radiogroup" aria-label="Чем помогаем">
        <button role="radio" aria-checked={mode === 'sets'} className={'chip' + (mode === 'sets' ? ' is-on' : '')} onClick={() => setMode('sets')}>
          Наборы через НКО
        </button>
        <button role="radio" aria-checked={mode === 'certs'} className={'chip' + (mode === 'certs' ? ' is-on' : '')} onClick={() => setMode('certs')}>
          Сертификаты фонда
        </button>
      </div>
      {mode === 'certs' && (
        <div className="cert-note">
          <label className="field">
            <span>Номинал сертификата</span>
            <span className="money">
              <input
                inputMode="numeric"
                value={nomDraft}
                onChange={(e) => setNomDraft(e.target.value)}
                onBlur={(e) => commitNominal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commitNominal((e.target as HTMLInputElement).value)}
                aria-label="Номинал сертификата в рублях"
                style={{ width: Math.max(4, nomDraft.length + 0.6) + 'ch' }}
              />
              <span>₽</span>
            </span>
          </label>
          <p className="muted small">
            Сертификат отоваривают в «Пятёрочке» и «Перекрёстке», поэтому регионы без магазинов X5 в расчёт не входят. Номинал по умолчанию 2 500 ₽: за первый
            год «Корзины доброты» фонд выдал больше 6 000 сертификатов на сумму больше 15 млн ₽ (
            <a href={CERT_SOURCE} target="_blank" rel="noreferrer">
              итоги фонда и РКК
            </a>
            ).
          </p>
        </div>
      )}
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
          Деньги, которые фонд распределяет сам: нецелевые пожертвования через сайт, удвоение сборов, софинансирование партнёров. Цена 1 кг продуктов учитывает местные цены.
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
                    {certs ? fmtInt(certTotal(s)) + ' серт., ' : ''}
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
                  {certs && (
                    <th scope="col" className="num">
                      Сертификатов
                    </th>
                  )}
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
                    {certs && <td className="num">{fmtInt(certs[p.strategy][r.iso] ?? 0)}</td>}
                    <td className="num">{fmtKg(r.kg)}</td>
                    <td className="num">{fmtInt(r.lifted)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {certs && (
            <p className="muted small">
              Число магазинов X5 в регионе — оценка по OpenStreetMap. Перед отправкой сертификатов стоит сверить, что в городах получателей есть «Пятёрочка» или
              «Перекрёсток».
            </p>
          )}
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
