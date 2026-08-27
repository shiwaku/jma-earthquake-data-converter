import type { Legend } from '../map/layers/types'

/** 凡例の HTML。連続量はグラデーションバー、カテゴリは色見本の並び。 */
export function legendMarkup(legend: Legend): string {
  if (legend.kind === 'items') {
    return legend.items
      .map(
        (it) =>
          `<span class="lg-row"><span class="lg-sw lg-${it.shape}" style="background:${it.color}"></span>${it.label}</span>`,
      )
      .join('')
  }
  const ticks = legend.ticks
    .map((t) => `<span class="lg-tick" style="left:${t.pos}%">${t.label}</span>`)
    .join('')
  return `<div class="lg-bar" style="background:${legend.css}"></div><div class="lg-ticks">${ticks}</div>`
}
