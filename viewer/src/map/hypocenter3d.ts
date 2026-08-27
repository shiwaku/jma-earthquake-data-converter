import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import type { Map as MapLibreMap } from 'maplibre-gl'

import type { AppStore } from '../state'

/**
 * 震源を深さで立体表示する。
 *
 * データは MLT（MapLibre Tile）で配る。仕様は3D座標に対応しているが、JS側は
 * 入口から出口まで2Dのため深さはジオメトリに持たせられない。
 *   - エンコーダ: mltEncoder の Position が [number, number]
 *   - デコーダ:   VertexBufferType.VEC_3 は enum に値があるだけで参照0件
 *   - MapLibre:   MLTVectorTileFeature.loadGeometry() が new Point(x, y) で z を捨てる
 * そのため深さは属性で運び、[lng, lat, -深さ×1000] の組み立ては deck.gl 側で行う。
 * これは参考実装（gsi-2026-mlt-demo）が建物の標高で採っている構成と同じ。
 *
 * データは震源レイヤー（layers/hypocenter.ts）のMLTソースをそのまま使う。取得は1系統で、
 * 2Dの×印と3Dの点群が同じタイルを共有する。
 * 震源レイヤーを非表示にするとソースごと外れるため、3Dの点群も消える。
 */

const SOURCE_ID = 'hypocenter'
const SOURCE_LAYER = 'hypocenter'

/**
 * 深さ→色の対応。参考実装（japan-eq-locator）と同じ Spectral 系の並びだが、
 * 目盛りは線形にしない。
 *
 * 震源の深さは極端に浅い側へ偏っている（10km以浅が63.7%、70km以浅が96.0%、
 * 200km以深は0.4%）。0〜700kmを線形に割り当てると、ほぼ全部が最初の色に潰れて
 * 深さの違いが読めない。浅い側に色を厚く配ることで、地殻内・スラブ内・深発を
 * 見分けられるようにする。
 */
const DEPTH_STOPS: [number, [number, number, number]][] = [
  [0, [158, 1, 66]],
  [10, [213, 62, 79]],
  [20, [244, 109, 67]],
  [40, [253, 174, 97]],
  [70, [254, 224, 139]],
  [100, [255, 255, 191]],
  [150, [171, 221, 164]],
  [250, [102, 194, 165]],
  [400, [50, 136, 189]],
  [700, [94, 79, 162]],
]

interface Point3D {
  position: [number, number, number]
  color: [number, number, number]
}

/** 深さ(km)に対応する色。区間ごとに線形補間する。 */
function depthColor(km: number): [number, number, number] {
  const d = Math.max(0, km)
  for (let i = 1; i < DEPTH_STOPS.length; i++) {
    const [d1, c1] = DEPTH_STOPS[i - 1]
    const [d2, c2] = DEPTH_STOPS[i]
    if (d <= d2) {
      const k = (d - d1) / (d2 - d1)
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * k),
        Math.round(c1[1] + (c2[1] - c1[1]) * k),
        Math.round(c1[2] + (c2[2] - c1[2]) * k),
      ]
    }
  }
  return DEPTH_STOPS[DEPTH_STOPS.length - 1][1]
}

/** 凡例のグラデーション（CSS）。地図上の凡例と配色をずらさないため、ここから作る。 */
export function depthLegendGradient(): string {
  const last = DEPTH_STOPS[DEPTH_STOPS.length - 1][0]
  const stops = DEPTH_STOPS.map(([d, c]) => `rgb(${c[0]},${c[1]},${c[2]}) ${((d / last) * 100).toFixed(1)}%`)
  return `linear-gradient(to right, ${stops.join(', ')})`
}

/** 凡例の目盛り。非線形なので位置を計算して置く。 */
export const DEPTH_TICKS = [0, 70, 150, 400, 700]

export function depthTickPosition(km: number): number {
  return (km / DEPTH_STOPS[DEPTH_STOPS.length - 1][0]) * 100
}

export function createHypocenter3d(map: MapLibreMap, store: AppStore): void {
  let overlay: MapboxOverlay | null = null
  // querySourceFeatures はタイルのロード・アンロードで返る集合が変動する。
  // 取得したものを加算キャッシュして削除しないことで、点の明滅を防ぐ。
  const cache = new Map<string, Point3D>()
  let pending = false

  function collect(): void {
    pending = false
    if (!store.get().depth3d) return
    let added = false
    for (const f of map.querySourceFeatures(SOURCE_ID, { sourceLayer: SOURCE_LAYER })) {
      const p = f.properties ?? {}
      const g = f.geometry
      if (g?.type !== 'Point') continue
      const [lng, lat] = g.coordinates as [number, number]
      // 地震IDは一意ではない（同じ秒の別レコードが衝突する）ため座標も混ぜる。
      // タイル境界をまたぐ重複を潰すのが目的なので、丸めて十分。
      const id = `${p['地震ID'] ?? ''}|${lng.toFixed(4)},${lat.toFixed(4)}`
      if (cache.has(id)) continue
      // 深さはkm。地下は負の高さになる。
      const km = Number(p['深さ'] ?? p['深さ(km)'] ?? 0)
      const z = -(Number.isFinite(km) ? km : 0) * 1000
      cache.set(id, { position: [lng, lat, z], color: depthColor(km) })
      added = true
    }
    if (added) render()
  }

  function schedule(): void {
    if (pending) return
    pending = true
    requestAnimationFrame(collect)
  }

  function render(): void {
    if (!overlay) return
    overlay.setProps({
      layers: [
        new ScatterplotLayer<Point3D>({
          id: 'hypocenter-3d',
          data: [...cache.values()],
          // 参考実装（japan-eq-locator）と同じく大きさは一定にして、重ね合わせの
          // 濃淡で密度を見せる。マグニチュードで変えると重なって潰れる。
          getPosition: (d) => d.position,
          getFillColor: (d) => d.color,
          // 参考実装と同じ考え方。点を小さく薄くして、重なりの濃淡で密度を見せる。
          // 大きく濃くすると20万点が一枚の塊になって深さが読めない。
          getRadius: 500,
          radiusMinPixels: 1,
          radiusMaxPixels: 4,
          opacity: 0.25,
          billboard: true,
          antialiasing: false,
          pickable: false,
        }),
      ],
    })
  }

  function enable(): void {
    if (!overlay) {
      overlay = new MapboxOverlay({ interleaved: true, layers: [] })
      map.addControl(overlay)
      map.on('sourcedata', onSourceData)
      map.on('moveend', schedule)
    }
    schedule()
  }

  function disable(): void {
    cache.clear()
    overlay?.setProps({ layers: [] })
  }

  function onSourceData(e: { sourceId?: string; sourceDataType?: string }): void {
    if (e.sourceId !== SOURCE_ID || e.sourceDataType === 'metadata') return
    schedule()
  }

  store.subscribe((s, prev) => {
    if (s.depth3d !== prev.depth3d) {
      if (s.depth3d) enable()
      else disable()
      return
    }
    // 背景やテーマの切替でスタイルごと作り直される。震源レイヤーのON/OFFでも
    // ソースが出入りするため、いずれも取り直す。
    if (s.depth3d && (s.theme !== prev.theme || s.basemap !== prev.basemap || s.layers !== prev.layers)) {
      map.once('idle', schedule)
    }
  })

  if (store.get().depth3d) enable()
}
