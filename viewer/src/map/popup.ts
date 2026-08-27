import { WebMercatorViewport } from '@deck.gl/core'
import { Popup, type Map as MapLibreMap } from 'maplibre-gl'

import { layerByKey } from './layers/registry'
import type { AppStore, Selection } from '../state'

/**
 * 立体表示の点は地下にある。地表の緯度経度にそのまま出すとポップアップだけが
 * 画面の上へ離れ、深いものほどずれる（深さ700kmでは200px近くになる）。
 * 地表と深さの投影差をピクセルのオフセットにして埋める。
 *
 * 投影は点を描いているのと同じ deck.gl の WebMercatorViewport で行う。
 * ここだけ別の式を使うとずれが残るため。地形は使っていないので、
 * @deck.gl/mapbox がMapLibreから組み立てるビューステートと同じものを作れば足りる。
 */
function altitudeOffset(map: MapLibreMap, lng: number, lat: number, altitude: number): [number, number] {
  const canvas = map.getCanvas()
  const center = map.getCenter()
  const viewport = new WebMercatorViewport({
    width: canvas.clientWidth,
    height: canvas.clientHeight,
    // 日付変更線付近で getCenter が [-180,180] の外を返すことがある
    longitude: ((center.lng + 540) % 360) - 180,
    latitude: center.lat,
    zoom: map.getZoom(),
    bearing: map.getBearing(),
    pitch: map.getPitch(),
    padding: map.getPadding(),
  })
  const ground = viewport.project([lng, lat, 0])
  const deep = viewport.project([lng, lat, altitude])
  return [deep[0] - ground[0], deep[1] - ground[1]]
}

/**
 * 選択された地物の属性を出すポップアップ。開閉は state.selection に従う。
 * ×ボタンや地図クリックで閉じられたときは、逆に選択を解除して state に返す。
 * 中身の組み立ては各レイヤーモジュールの popupHtml が持つ。
 */
export function createPopup(map: MapLibreMap, store: AppStore): void {
  let popup: Popup | null = null

  function offsetFor(s: Selection): [number, number] | undefined {
    return s.altitude ? altitudeOffset(map, s.lng, s.lat, s.altitude) : undefined
  }

  function close(): void {
    if (!popup) return
    // close ハンドラの誤発火を防ぐため、参照を外してから remove する
    const old = popup
    popup = null
    old.remove()
  }

  function render(): void {
    close()
    const { selection, eventId, theme } = store.get()
    if (!selection) return
    const mod = layerByKey(selection.layerKey)
    if (!mod) return

    const p = new Popup({ closeButton: true, maxWidth: '320px', offset: offsetFor(selection) })
      .setLngLat([selection.lng, selection.lat])
      .setHTML(mod.popupHtml(selection.properties, selection.lng, selection.lat, { eventId, theme }))
      .addTo(map)
    p.on('close', () => {
      if (popup !== p) return
      popup = null
      store.set({ selection: null })
    })
    popup = p
  }

  // 傾きやズームが変わると地表とのずれ幅も変わる。動いているあいだ追従させる。
  map.on('move', () => {
    const s = store.get().selection
    if (!popup || !s?.altitude) return
    popup.setOffset(altitudeOffset(map, s.lng, s.lat, s.altitude))
  })

  store.subscribe((s, prev) => {
    if (s.selection !== prev.selection) render()
  })
}
