import type { Map as MapLibreMap } from 'maplibre-gl'

import { DEPTH_TICKS, depthLegendGradient, depthTickPosition } from '../map/hypocenter3d'
import type { AppStore } from '../state'

/**
 * 震源の深さ立体表示の切替。
 *
 * 立体にする以上カメラを傾けないと何も分からないため、ONで pitch を倒す。
 * OFFでは真上に戻す。利用者が手で傾けた角度は覚えず、モードに紐づける。
 */
const PITCH_ON = 60

export function createDepth3dToggle(map: MapLibreMap, store: AppStore): void {
  const btn = document.getElementById('depth3d-btn') as HTMLButtonElement | null
  const legend = document.getElementById('depth3d-legend') as HTMLElement | null
  if (!btn) return

  // 配色は hypocenter3d.ts が持つ。凡例をそこから組み立てて、地図と食い違わせない。
  if (legend) {
    const bar = legend.querySelector('.dl-bar') as HTMLElement
    const ticks = legend.querySelector('.dl-ticks') as HTMLElement
    bar.style.background = depthLegendGradient()
    ticks.innerHTML = DEPTH_TICKS.map(
      (km) => `<span style="left:${depthTickPosition(km).toFixed(1)}%">${km}${km === 700 ? 'km' : ''}</span>`,
    ).join('')
  }

  function render(): void {
    const on = store.get().depth3d
    btn!.setAttribute('aria-pressed', String(on))
    btn!.textContent = on ? '深さ3D: ON' : '深さ3D'
    if (legend) legend.hidden = !on
  }

  btn.addEventListener('click', () => {
    const on = !store.get().depth3d
    store.set({ depth3d: on })
    map.easeTo({ pitch: on ? PITCH_ON : 0, duration: 600 })
  })

  store.subscribe((s, prev) => {
    if (s.depth3d !== prev.depth3d) render()
  })

  render()
}
