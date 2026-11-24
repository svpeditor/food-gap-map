export function Sparkline({ series, label }: { series: Record<string, number>; label: string }) {
  const years = Object.keys(series).sort()
  const vals = years.map((y) => series[y])
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const w = 84
  const h = 22
  const pts = vals.map((v, i) => [(i / Math.max(1, vals.length - 1)) * w, h - 2 - ((v - min) / Math.max(1e-9, max - min)) * (h - 4)])
  return (
    <svg className="spark" width={w} height={h} viewBox={'0 0 ' + w + ' ' + h} role="img" aria-label={label + ': ' + years.map((y, i) => y + ' — ' + vals[i] + ' %').join(', ')}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill="currentColor" />
    </svg>
  )
}
