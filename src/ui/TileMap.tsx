import { useMemo, useState } from 'react'
import type { Region } from '../types'
import { ABBR } from '../config'
import { colorOf, inkOn, type Layer, type LayerCtx } from './layers'

const T = 56
const GAP = 5

interface Props {
  regions: Region[]
  layer: Layer
  ctx: LayerCtx
  selected: string | null
  onSelect: (iso: string) => void
}

export function TileMap({ regions, layer, ctx, selected, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null)
  const cols = Math.max(...regions.map((r) => r.tile[0])) + 1
  const rows = Math.max(...regions.map((r) => r.tile[1])) + 1
  const width = cols * (T + GAP) - GAP
  const height = rows * (T + GAP) - GAP
  const tiles = useMemo(
    () =>
      regions.map((r) => {
        const v = layer.value(r, ctx)
        const fill = colorOf(layer, v)
        return { r, v, fill, ink: inkOn(fill) }
      }),
    [regions, layer, ctx],
  )
  const hovered = tiles.find((t) => t.r.iso === hover)

  return (
    <div className="tilemap">
      <svg viewBox={'0 0 ' + width + ' ' + height} role="group" aria-label={'Карта регионов: ' + layer.title.toLowerCase()}>
        {tiles.map(({ r, v, fill, ink }) => {
          const x = r.tile[0] * (T + GAP)
          const y = r.tile[1] * (T + GAP)
          const isSel = r.iso === selected
          return (
            <g
              key={r.iso}
              className={'tile' + (isSel ? ' is-selected' : '')}
              style={{ ['--col' as string]: r.tile[0] }}
              transform={'translate(' + x + ' ' + y + ')'}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={r.short + ': ' + layer.format(v)}
              onClick={() => onSelect(r.iso)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(r.iso)
                }
              }}
              onMouseEnter={() => setHover(r.iso)}
              onMouseLeave={() => setHover((h) => (h === r.iso ? null : h))}
              onFocus={() => setHover(r.iso)}
              onBlur={() => setHover((h) => (h === r.iso ? null : h))}
            >
              <rect width={T} height={T} rx={4} fill={fill} />
              <text x={T / 2} y={T / 2 + 5} textAnchor="middle" fill={ink} className={'tile-label' + ((ABBR[r.iso] ?? '').length > 3 ? ' is-long' : '')}>
                {ABBR[r.iso] ?? r.short.slice(0, 3)}
              </text>
              <rect className="tile-ring" x={-2.5} y={-2.5} width={T + 5} height={T + 5} rx={6} />
            </g>
          )
        })}
      </svg>
      <div className="tilemap-tip" aria-hidden="true">
        {hovered ? (
          <>
            <b>{hovered.r.short}</b> {layer.format(hovered.v)}
          </>
        ) : (
          <span className="muted">Наведите на регион или выберите его, чтобы увидеть подробности</span>
        )}
      </div>
    </div>
  )
}
