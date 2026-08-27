import type { Map as MapLibreMap, SourceSpecification } from 'maplibre-gl'
import { getBasemapStyle } from './basemap'
import { LAYERS } from './layers/registry'
import type { LayerModule, PaintContext } from './layers/types'
import type { AppState, AppStore } from '../state'

/** 有効なレイヤーの ID のうち、地図に載っているもの（クリック判定に使う）。 */
export function activePickIds(map: MapLibreMap, state: AppState): string[] {
  return LAYERS.filter((m) => state.layers[m.def.key].visible)
    .map((m) => m.pickLayerId)
    .filter((id): id is string => id !== null && Boolean(map.getLayer(id)))
}

/**
 * ソース定義。MLT は encoding を worker へ伝える必要があり、それは TileJSON 経由でしか
 * 伝わらない。インラインの tiles:[...] だと MVT として誤パースされて失敗するため、
 * TileJSON を Blob URL に組み立てて url で渡す。
 */
function sourceSpec(mod: LayerModule): SourceSpecification {
  const { url, sourceLayer, attribution, format, minzoom, maxzoom } = mod.def
  if (format !== 'mlt') {
    return { type: 'vector', url: `pmtiles://${url}`, attribution }
  }
  const tilejson = {
    tilejson: '2.2.0',
    tiles: [url],
    minzoom: minzoom ?? 0,
    maxzoom: maxzoom ?? 8,
    attribution,
    vector_layers: [{ id: sourceLayer, fields: {} }],
  }
  const blob = URL.createObjectURL(new Blob([JSON.stringify(tilejson)], { type: 'application/json' }))
  return { type: 'vector', url: blob, encoding: 'mlt', attribution } as SourceSpecification
}

export function createDataLayers(map: MapLibreMap, store: AppStore): void {
  const ctxFor = (mod: LayerModule): PaintContext => {
    const s = store.get()
    return {
      eventId: s.eventId,
      theme: s.theme,
      opacity: s.layers[mod.def.key].opacity,
      depth3d: s.depth3d,
    }
  }

  // canonical z順: LAYERS 配列の後ろほど地図で最前面。
  // mod の直上に来るべき既存レイヤーを beforeId に指定して正規順で挿入する。
  function beforeIdFor(mod: LayerModule): string | undefined {
    const i = LAYERS.indexOf(mod)
    for (let j = i + 1; j < LAYERS.length; j++) {
      for (const id of LAYERS[j].layerIds) {
        if (map.getLayer(id)) return id
      }
    }
    return undefined
  }

  function ensureLayer(mod: LayerModule): void {
    if (!map.getSource(mod.def.key)) map.addSource(mod.def.key, sourceSpec(mod))
    const before = beforeIdFor(mod)
    for (const spec of mod.specs(ctxFor(mod))) {
      if (map.getLayer(spec.id)) continue
      map.addLayer(spec, before)
    }
  }

  function removeLayer(mod: LayerModule): void {
    for (const id of mod.layerIds) {
      if (map.getLayer(id)) map.removeLayer(id)
    }
    if (map.getSource(mod.def.key)) map.removeSource(mod.def.key)
  }

  /** 有効なレイヤーのみを（正規 z順で）地図に載せる。無効なものはソースごと持たない＝軽量。 */
  function sync(): void {
    // 背景を差し替えている最中はスタイルが入れ替わっており、ソースを足せない
    // （addSource が "Style is not done loading" で落ちる）。落ち着いてからやり直す。
    // 背景を切り替えた直後にレイヤーを触ると通る道。
    if (!map.isStyleLoaded()) {
      map.once('idle', sync)
      return
    }
    const state = store.get()
    for (const mod of LAYERS) {
      if (state.layers[mod.def.key].visible) ensureLayer(mod)
      else removeLayer(mod)
    }
  }

  function applyPaint(): void {
    const state = store.get()
    for (const mod of LAYERS) {
      if (!state.layers[mod.def.key].visible) continue
      const ctx = ctxFor(mod)
      for (const u of mod.paintUpdates(ctx)) {
        // paintのプロパティ名と値はレイヤーモジュールが汎用の型で持つため、ここで型を合わせる
        if (map.getLayer(u.id)) map.setPaintProperty(u.id, u.prop as never, u.value as never)
      }
      for (const u of mod.layoutUpdates?.(ctx) ?? []) {
        if (map.getLayer(u.id)) map.setLayoutProperty(u.id, u.prop as never, u.value as never)
      }
    }
  }

  /** 表示中の地震を切り替える。震源は214,763件あり属性化できないためフィルタで絞る。 */
  function applyFilter(): void {
    const state = store.get()
    for (const mod of LAYERS) {
      if (!state.layers[mod.def.key].visible) continue
      for (const u of mod.filters(ctxFor(mod))) {
        if (map.getLayer(u.id)) map.setFilter(u.id, u.filter)
      }
    }
  }

  // 背景スタイルを差し替える。ラスタ（写真）↔ベクタ（淡色）の切替では diff 適用が
  // 効かず背景が入れ替わらないため diff:false で完全に再構築する。
  // setStyle 直後は isStyleLoaded() が旧スタイルで true を返して競合するため、
  // 新スタイルの描画が落ち着く idle を待ってからデータ層を再追加する。
  function reloadStyle(): void {
    const s = store.get()
    map.setStyle(getBasemapStyle(s.basemap, s.theme), { diff: false })
    map.once('idle', sync)
  }

  store.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.basemap !== prev.basemap) {
      reloadStyle()
      return
    }
    if (s.layers !== prev.layers) {
      sync()
      applyPaint()
      applyFilter()
      return
    }
    if (s.eventId !== prev.eventId) applyFilter()
    // 立体表示の切替で震源の高さが変わる
    if (s.depth3d !== prev.depth3d) applyPaint()
  })

  map.on('load', sync)

  // WebGL コンテキスト消失からの復帰。iOS Safari 等ではメモリ逼迫時に GL コンテキストが
  // 失われ、データ層がまるごと消えて戻らないことがある。復帰時に貼り直して自動回復する。
  map.getCanvas().addEventListener(
    'webglcontextrestored',
    () => {
      if (map.isStyleLoaded()) sync()
      else map.once('idle', sync)
    },
    false,
  )
}
