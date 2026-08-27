import type { Map as MapLibreMap } from 'maplibre-gl'

import { activePickIds } from './dataLayers'
import { layerByPickId } from './layers/registry'
import type { AppStore } from '../state'

/**
 * クリックで地物を選択し、ホバーでカーソルを変える。
 * 選択そのものは store に入れるだけで、描くのはポップアップ側の仕事。
 */
export function createInteractions(map: MapLibreMap, store: AppStore): void {
  // ホバーのカーソルはマウス環境だけ。タッチでは意味がないうえ、
  // mousemove がタップのたびに走ってしまう。
  if (window.matchMedia('(hover: hover)').matches) {
    map.on('mousemove', (e) => {
      const ids = activePickIds(map, store.get())
      const hit = ids.length > 0 && map.queryRenderedFeatures(e.point, { layers: ids }).length > 0
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
    })
  }

  map.on('click', (e) => {
    const ids = activePickIds(map, store.get())
    const feats = ids.length ? map.queryRenderedFeatures(e.point, { layers: ids }) : []
    if (!feats.length) {
      store.set({ selection: null })
      return
    }
    // 最前面のものを採る。震源（×）→震度（点）→人口集中地区（面）の順に当たる。
    const f = feats[0]
    const mod = layerByPickId(f.layer.id)
    if (!mod) return
    store.set({
      selection: {
        layerKey: mod.def.key,
        properties: f.properties as Record<string, unknown>,
        lng: e.lngLat.lng,
        lat: e.lngLat.lat,
      },
    })
  })

  store.subscribe((s, prev) => {
    if (!s.selection) return
    // 地震を切り替えると、選択していた地物は地図から消える。
    // レイヤーを消したときも同じ。取り残されたポップアップを閉じる。
    const gone =
      s.eventId !== prev.eventId ||
      (s.layers !== prev.layers && !s.layers[s.selection.layerKey]?.visible)
    if (gone) store.set({ selection: null })
  })
}
