import type { Region } from '../types'
import { fmtPeople, gapPhrase } from '../format'

interface Props {
  worst: { region: Region; gap: number }[]
  usingUpload: boolean
  onSelect: (iso: string) => void
}

export function RussiaCard({ worst, usingUpload, onSelect }: Props) {
  return (
    <article className="card">
      <header className="card-head">
        <div>
          <h3>Где помощи меньше всего</h3>
          <p className="muted">
            Регионы, где на одного малоимущего приходится меньше всего помощи{usingUpload ? ' по вашей выгрузке' : ' (модель: помощь там, где магазины X5)'}.
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
    </article>
  )
}
