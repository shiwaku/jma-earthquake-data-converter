import type { Map as MapLibreMap, PaddingOptions } from 'maplibre-gl'

import { eventById } from '../lib/events'
import { isMobile } from '../lib/env'
import type { AppStore } from '../state'

/**
 * 選んだ地震にカメラを寄せる。
 *
 * 旧ビューワは14件分の中心座標とズームを手で表に持っていた。ここでは索引の bbox
 * （強く揺れた観測点の外接矩形＋震源）に合わせるので、全件で同じ質で寄せられる。
 */
const MAX_ZOOM = 11
const DURATION = 900

/** パネルに隠れる範囲を避ける。パネルは左（モバイルは下）に出る。 */
function padding(map: MapLibreMap): PaddingOptions {
  const { width, height } = map.getCanvas().getBoundingClientRect()
  const base = 40
  const panel = isMobile
    ? { bottom: Math.min(height * 0.45, height - base * 3) }
    : { left: Math.min(340, width - base * 3) }
  return { top: base, right: base, bottom: base, left: base, ...panel }
}

export function createEventCamera(map: MapLibreMap, store: AppStore, skipFirst = false): void {
  let skip = skipFirst

  store.subscribe((s, prev) => {
    if (s.eventId === prev.eventId) return
    // URLに位置が入っていた場合、初回の既定選択でそれを上書きしない。
    if (skip) {
      skip = false
      return
    }
    const bbox = s.eventId ? eventById(s.eventId)?.bbox : undefined
    if (!bbox) return
    map.fitBounds(bbox, { padding: padding(map), maxZoom: MAX_ZOOM, duration: DURATION })
  })
}
