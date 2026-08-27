import type { Map as MapLibreMap, Point } from 'maplibre-gl'

import { activePickIds } from './dataLayers'
import type { Hypocenter3dPicker } from './hypocenter3d'
import { layerByPickId } from './layers/registry'
import type { AppStore } from '../state'

/**
 * クリックで地物を選択し、ホバーでカーソルを変える。
 * 選択そのものは store に入れるだけで、描くのはポップアップ側の仕事。
 *
 * 当たり判定は2系統ある。地表に描かれるレイヤーはMapLibreに、
 * 深さ方向へ配置した震源の点は deck.gl（picker）に問い合わせる。
 * 見えている点を狙ってクリックするのだから、立体表示の点を先に見る。
 */
export function createInteractions(map: MapLibreMap, store: AppStore, picker: Hypocenter3dPicker): void {
  // ホバーのカーソルはマウス環境だけ。タッチでは意味がないうえ、
  // mousemove がタップのたびに走ってしまう。
  if (window.matchMedia('(hover: hover)').matches) {
    // 立体表示の当たり判定は GPU からの読み戻しを伴うため、mousemove のたびに
    // 走らせると重い。最後の位置だけを覚えて1フレームに1回へ間引く。
    let queued = false
    let last: Point | null = null

    function updateCursor(): void {
      queued = false
      if (!last) return
      const ids = activePickIds(map, store.get())
      const hit =
        (ids.length > 0 && map.queryRenderedFeatures(last, { layers: ids }).length > 0) ||
        picker.hitTest(last.x, last.y)
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
    }

    map.on('mousemove', (e) => {
      last = e.point
      if (queued) return
      queued = true
      requestAnimationFrame(updateCursor)
    })
  }

  map.on('click', (e) => {
    const hit3d = picker.pick(e.point.x, e.point.y)
    if (hit3d) {
      store.set({ selection: hit3d })
      return
    }
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
