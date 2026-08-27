import type { Map as MapLibreMap } from 'maplibre-gl'

import { depthLegendCss, depthLegendTicks } from '../map/layers/depthScale'
import type { AppStore } from '../state'

/**
 * 深さの凡例と、傾けたときの背景減光。
 *
 * 震源の立体表示そのものは常時有効（state.depth3d は既定 true）なので、
 * 切替ボタンは持たない。凡例は常に出す。
 *
 * 背景の減光だけは傾きに連動させる。真上から見ているあいだは地表と地下が
 * 重なって見えるだけで減光する意味がなく、地図が読みにくくなるため。
 * しきい値に幅を持たせて、境界付近でちらつかないようにする。
 */
const PITCH_DIM_ON = 25
const PITCH_DIM_OFF = 20

export function createDepth3dAuto(map: MapLibreMap, store: AppStore): void {
  const legend = document.getElementById('depth3d-legend') as HTMLElement | null

  // 配色は map/layers/depthScale.ts が持つ。凡例をそこから組み立てて、地図と食い違わせない。
  if (legend) {
    const bar = legend.querySelector('.dl-bar') as HTMLElement
    const ticks = legend.querySelector('.dl-ticks') as HTMLElement
    bar.style.background = depthLegendCss()
    ticks.innerHTML = depthLegendTicks()
      .map(({ pos, label }) => `<span style="left:${pos.toFixed(1)}%">${label}</span>`)
      .join('')
    legend.hidden = false
  }

  function syncDim(): void {
    const pitch = map.getPitch()
    const dimmed = store.get().basemapDim
    if (!dimmed && pitch >= PITCH_DIM_ON) store.set({ basemapDim: true })
    else if (dimmed && pitch < PITCH_DIM_OFF) store.set({ basemapDim: false })
  }

  map.on('pitch', syncDim)
  syncDim()
}
