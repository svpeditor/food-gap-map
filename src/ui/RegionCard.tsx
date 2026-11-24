import type { Dataset, Region } from '../types'
import { coverage } from '../model/metrics'
import { fmtInt, fmtKg, fmtNum, fmtPeople, gapPhrase } from '../format'
import { Sparkline } from './Sparkline'
import type { LayerCtx } from './layers'
import { gapIndex } from '../model/metrics'

/** 0,004 кг -> «4 г», 2,3 кг -> «2,3 кг» */
function perPoor(kg: number): string {
  if (kg <= 0) return '0 кг'
  return kg < 1 ? '≈ ' + fmtNum(kg * 1000, 0) + ' г' : '≈ ' + fmtNum(kg, 1) + ' кг'
}

interface Props {
  ds: Dataset
  region: Region
  ctx: LayerCtx
  rank: number
  usingUpload: boolean
  onClose: () => void
}

export function RegionCard({ ds, region: r, ctx, rank, usingUpload, onClose }: Props) {
  const gap = gapIndex(r, ctx.aid, ctx.national)
  const aidKg = ctx.aid[r.iso] ?? 0
  const ru = ds.russia
  const brands = r.stores_by_brand
  return (
    <article className="card" aria-live="polite">
      <header className="card-head">
        <div>
          <h3>{r.short}</h3>
          <p className="muted">{r.name.replace(/\s+/g, ' ')}, {r.fd} федеральный округ</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Закрыть карточку региона">×</button>
      </header>

      <div className={'tag ' + (gap < 0.5 ? 'is-deficit' : gap > 1.1 ? 'is-surplus' : '')}>
        <span className="tag-label">Помощи на одного малоимущего</span>
        <span className="tag-value">{gapPhrase(gap)}</span>
        <span className="tag-note">
          {rank} место из {ds.regions.length} по нехватке{usingUpload ? ', по вашей выгрузке' : ', по модели'}
        </span>
      </div>

      <dl className="facts">
        <div>
          <dt>Уровень бедности, {ds.meta.years.poverty}</dt>
          <dd>
            {fmtNum(r.poverty_rate)} % <span className="muted">в России {fmtNum(ru.poverty_rate)} %</span>
            <Sparkline series={r.poverty_series} label="Уровень бедности по годам" />
          </dd>
        </div>
        <div>
          <dt>Малоимущих</dt>
          <dd>≈ {fmtPeople(r.poor)} человек</dd>
        </div>
        <div>
          <dt>Минимальный набор продуктов</dt>
          <dd>
            {fmtInt(r.basket)} ₽ в месяц{' '}
            <span className="muted">
              {r.price_index >= 1 ? 'на ' + fmtNum((r.price_index - 1) * 100, 0) + ' % дороже' : 'на ' + fmtNum((1 - r.price_index) * 100, 0) + ' % дешевле'} среднего
            </span>
          </dd>
        </div>
        <div>
          <dt>Магазины X5, оценка</dt>
          <dd>
            {r.stores_est < 1 ? 'нет' : '≈ ' + fmtInt(r.stores_est)}{' '}
            {r.stores_est >= 1 && (
              <span className="muted">
                «Пятёрочка» {fmtInt(brands.pyaterochka)}, «Перекрёсток» {fmtInt(brands.perekrestok)}, «Чижик» {fmtInt(brands.chizhik)}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>{usingUpload ? 'Помощь по выгрузке' : 'Помощь по модели'}</dt>
          <dd>
            {fmtKg(aidKg)} в год <span className="muted">{perPoor(coverage(r, ctx.aid))} на малоимущего</span>
          </dd>
        </div>
      </dl>

      {r.facts.length > 0 && (
        <section className="card-known">
          <h4>Известно из пресс-релизов X5</h4>
          <ul>
            {r.facts.map((f) => (
              <li key={f.program + f.city}>
                {f.city}: {fmtKg(f.kg)} {f.kind}, {f.period}.{' '}
                <a href={f.url} target="_blank" rel="noreferrer">
                  Источник
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
