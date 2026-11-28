import type { Region } from '../types'
import { fmtPeople, gapPhrase } from '../format'

interface Props {
  worst: { region: Region; gap: number }[]
  noStores: Region[]
  usingUpload: boolean
  onSelect: (iso: string) => void
}

export function RussiaCard({ worst, noStores, usingUpload, onSelect }: Props) {
  return (
    <article className="card">
      <header className="card-head">
        <div>
          <h3>Где помощи меньше всего</h3>
          <p className="muted">
            {usingUpload
              ? 'Регионы, где на одного малоимущего приходится меньше всего помощи по вашей выгрузке.'
              : 'Регионы с магазинами X5, где на одного малоимущего приходится меньше всего помощи (модель: помощь там, где магазины).'}
          </p>
        </div>
      </header>
      <ol className="worst">
        {worst.map(({ region: r, gap }) => (
          <li key={r.iso}>
            <button className="link-btn" onClick={() => onSelect(r.iso)}>
              {r.short}
            </button>
            <span className="muted">
              {fmtPeople(r.poor)} малоимущих, {gapPhrase(gap)}
            </span>
          </li>
        ))}
      </ol>
      {noStores.length > 0 && (
        <p className="muted small no-stores">
          Без магазинов X5 ({noStores.length}):{' '}
          {noStores.map((r, i) => (
            <span key={r.iso}>
              {i > 0 && ', '}
              <button className="link-btn" onClick={() => onSelect(r.iso)}>
                {r.short}
              </button>
            </span>
          ))}
          . Сбор в магазинах сюда не дотягивается, помощь возможна через НКО-партнёров фонда и отделения РКК.
        </p>
      )}
    </article>
  )
}
