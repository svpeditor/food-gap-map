import type { Layer } from './layers'

export function Legend({ layer }: { layer: Layer }) {
  return (
    <div className="legend" aria-label="Легенда">
      {layer.colors.map((c, i) => (
        <span key={c} className="legend-item">
          <i style={{ background: c }} />
          {layer.labels[i]}
        </span>
      ))}
    </div>
  )
}
