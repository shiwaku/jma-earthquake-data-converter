import type { Legend, SwatchItem } from '../map/layers/types'

/** 見本は地図での描かれ方に合わせる。塗りの図形は背景色、×印は文字そのもので示す。 */
function swatch(it: SwatchItem): string {
  if (it.shape === 'cross') {
    const halo = it.haloColor ? `;text-shadow:0 0 2px ${it.haloColor},0 0 2px ${it.haloColor}` : ''
    return `<span class="lg-sw lg-cross" style="color:${it.color}${halo}">×</span>`
  }
  return `<span class="lg-sw lg-${it.shape}" style="background:${it.color}"></span>`
}

/** 凡例の HTML。連続量はグラデーションバー、カテゴリは色見本の並び。 */
export function legendMarkup(legend: Legend): string {
  if (legend.kind === 'items') {
    return legend.items.map((it) => `<span class="lg-row">${swatch(it)}${it.label}</span>`).join('')
  }
  const ticks = legend.ticks
    .map((t) => `<span class="lg-tick" style="left:${t.pos}%">${t.label}</span>`)
    .join('')
  return `<div class="lg-bar" style="background:${legend.css}"></div><div class="lg-ticks">${ticks}</div>`
}
