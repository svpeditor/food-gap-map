import { useMemo, useState } from 'react'
import type { AidMap, Params, Region } from '../types'
import { vatScenario } from '../model/vat'
import { lifted } from '../model/effect'
import { fmtInt, fmtKg, fmtNum } from '../format'

interface Props {
  regions: Region[]
  aid: AidMap
  params: Params
  usingUpload: boolean
}

export function VatScenario({ regions, aid, params, usingUpload }: Props) {
  const [growth, setGrowth] = useState(params.vat_growth_min)
  const [copied, setCopied] = useState(false)
  const v = useMemo(() => vatScenario(regions, aid, growth, params.msu_coef), [regions, aid, growth, params.msu_coef])
  const totalPoor = regions.reduce((s, r) => s + r.poor, 0)
  const top = useMemo(
    () =>
      regions
        .map((r) => ({ r, lifted: lifted(r, (v.extraKg * r.poor) / totalPoor, params.msu_coef) }))
        .sort((a, b) => b.lifted - a.lifted)
        .slice(0, 5),
    [regions, v.extraKg, totalPoor, params.msu_coef],
  )
  const baseKg = regions.reduce((s, r) => s + (aid[r.iso] ?? 0), 0)
  const [lo, hi] = params.vat_cost_per_100

  const brief =
    'Освобождение передачи продуктов на благотворительность от НДС, по оценке экономического факультета МГУ, увеличит объём продуктовой помощи как минимум на 40 %. ' +
    'Сейчас из-за невозможности возместить НДС бизнес теряет от ' + lo + ' до ' + hi + ' ₽ на каждые 100 ₽ переданной продукции. ' +
    'Для программы с объёмом ' + fmtKg(baseKg) + ' в год рост на ' + fmtNum(growth * 100, 0) + ' % означает дополнительно ' + fmtKg(v.extraKg) + ' продуктов в год. ' +
    'По коэффициенту исследования фонда «Выручаем» и МГУ (+1 кг на душу в год связан со снижением уровня бедности на 20,55 %) это соответствует снижению числа малоимущих примерно на ' +
    fmtInt(v.lifted) + ' человек при нынешней географии помощи и на ' + fmtInt(v.liftedIfByNeed) + ' человек, если направить прирост в регионы по числу малоимущих. ' +
    'Больше всего выиграли бы: ' + top.map((t) => t.r.short + ' (' + fmtInt(t.lifted) + ')').join(', ') + '. ' +
    'Расчёт: «Карта продовольственного разрыва», данные Росстата ' + 2025 + ' года.'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="vat">
      <div className="vat-controls">
        <label className="field" htmlFor="vat-growth">
          <span>
            Рост объёма помощи без НДС: <b>+{fmtNum(growth * 100, 0)} %</b>
          </span>
        </label>
        <input
          id="vat-growth"
          type="range"
          min={0.1}
          max={3}
          step={0.1}
          value={growth}
          onChange={(e) => setGrowth(Number(e.target.value))}
          aria-valuetext={'плюс ' + fmtNum(growth * 100, 0) + ' процентов'}
        />
        <p className="muted small">
          40 % — минимальная оценка МГУ. По словам исследователей, фактический рост может быть многократно выше за счёт подключения новых магазинов.
        </p>
      </div>
      <div className="vat-results">
        <p>
          <span className="big">+{fmtKg(v.extraKg)}</span> продуктов в год{usingUpload ? ' к вашей выгрузке' : ' к ' + fmtKg(baseKg) + ' сейчас'}
        </p>
        <p>
          <span className="big">−{fmtInt(v.lifted)}</span> малоимущих, если прирост распределится как сейчас
        </p>
        <p>
          <span className="big">−{fmtInt(v.liftedIfByNeed)}</span> если направить его по нужде
        </p>
      </div>
      <figure className="brief">
        <figcaption>Справка для письма или выступления</figcaption>
        <p>{brief}</p>
        <div className="row-actions">
          <button className="btn" onClick={copy}>
            {copied ? 'Скопировано' : 'Скопировать текст'}
          </button>
          <button className="btn-ghost" onClick={() => window.print()}>
            Распечатать страницу
          </button>
        </div>
      </figure>
    </div>
  )
}
