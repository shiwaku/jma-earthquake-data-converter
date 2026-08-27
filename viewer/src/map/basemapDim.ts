import type { Map as MapLibreMap } from 'maplibre-gl'

import type { AppStore } from '../state'

/**
 * 立体表示のあいだ、背景地図を薄くする。
 *
 * deck.gl はオーバーレイ描画なので、地下の点も背景地図の上に描かれる。見えなくは
 * ないが、地表面と地下の点が同じ平面に重なって「地面より上か下か」が読めない。
 * 背景を落とすと、地表が半透明のシートとして手前に立ち、その下に点があると分かる。
 *
 * 背景スタイルは200以上のレイヤーからなり、全体の不透明度を一括で指定する手段が
 * ないため、レイヤーごとに opacity 系のプロパティを掛け直す。元の値は覚えておいて
 * 抜けるときに戻す。
 */
const DIM = 1

/** 種別ごとの opacity プロパティ。 */
const OPACITY_PROP: Record<string, string> = {
  background: 'background-opacity',
  fill: 'fill-opacity',
  line: 'line-opacity',
  symbol: 'text-opacity',
  raster: 'raster-opacity',
  circle: 'circle-opacity',
  'fill-extrusion': 'fill-extrusion-opacity',
}

/** データレイヤーは対象外。背景（ベースマップ）だけを薄くする。 */
const DATA_SOURCES = new Set(['did', 'shindo', 'hypocenter', 'unfelt'])

export function createBasemapDim(map: MapLibreMap, store: AppStore): void {
  /** レイヤーID+プロパティ → 元の値。 */
  let saved: [string, string, unknown][] = []

  function basemapLayers(): { id: string; prop: string }[] {
    const out: { id: string; prop: string }[] = []
    for (const layer of map.getStyle()?.layers ?? []) {
      const src = (layer as { source?: string }).source
      if (src && DATA_SOURCES.has(src)) continue
      const prop = OPACITY_PROP[layer.type]
      if (prop) out.push({ id: layer.id, prop })
    }
    return out
  }

  function dim(): void {
    restore()
    for (const { id, prop } of basemapLayers()) {
      if (!map.getLayer(id)) continue
      const current = map.getPaintProperty(id, prop as never)
      saved.push([id, prop, current])
      // 式で指定されている場合は掛け算に包む。数値ならそのまま掛ける。
      const next =
        typeof current === 'number'
          ? current * DIM
          : current === undefined
            ? DIM
            : (['*', current, DIM] as unknown)
      try {
        map.setPaintProperty(id, prop as never, next as never)
      } catch {
        // 掛け算にできない指定（画像など）は諦めて元に戻す
        saved.pop()
      }
    }
  }

  function restore(): void {
    for (const [id, prop, value] of saved) {
      if (map.getLayer(id)) map.setPaintProperty(id, prop as never, value as never)
    }
    saved = []
  }

  store.subscribe((s, prev) => {
    if (s.basemapDim !== prev.basemapDim) {
      if (s.basemapDim) dim()
      else restore()
      return
    }
    // スタイルを作り直したら掛け直す（覚えていた値は無効になる）
    if (s.basemapDim && (s.theme !== prev.theme || s.basemap !== prev.basemap)) {
      saved = []
      map.once('idle', dim)
    }
  })

  // 初期カメラを傾けてあるため、起動時から減光が要る。
  // 背景スタイルのレイヤーが揃ってからでないと掛けられないので idle を待つ。
  if (store.get().basemapDim) map.once('idle', dim)
}
