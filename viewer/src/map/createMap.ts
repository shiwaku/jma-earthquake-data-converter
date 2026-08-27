import {
  AttributionControl,
  FullscreenControl,
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  addProtocol,
  setWorkerUrl,
} from 'maplibre-gl'
// maplibre 6 はワーカーの場所を実行時に import.meta.url から決める（同じ階層に
// maplibre-gl-worker.mjs がある前提）。バンドルすると import.meta.url は
// assets/index-*.js を指すためワーカーが404になり、タイルが1枚も復号されない。
// 症状は「地図が真っ白なまま load イベントが飛ばず、データレイヤーも追加されない」。
// ?worker&url でVite側にワーカーを別チャンクとして吐かせ、そのURLを渡して回避する。
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Protocol } from 'pmtiles'

import { isMobile } from '../lib/env'
import type { AppState } from '../state'
import { getBasemapStyle } from './basemap'

setWorkerUrl(workerUrl)

const ATTRIBUTION =
  '<a href="https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html" target="_blank" rel="noreferrer">気象庁 地震月報(カタログ編)</a>'

/**
 * deck.gl（@deck.gl/mapbox）との互換のため map.transform を生やす。
 *
 * deck.gl の getViewport は `map.transform.height` を読んでニアクリップ面を正規化する。
 * maplibre 6 で transform が `map._camera.transform` へ移ったため、そのままでは
 * interleaved 描画が「Cannot read properties of undefined (reading 'height')」で落ちる。
 *
 * deck.gl が transform を触るのはここと地形使用時だけで、いずれも読み取りのみ。
 * 別名を用意すれば足りる。maplibre 側が公開APIに戻すか deck.gl 側が追随したら外す。
 */
function exposeTransform(map: MapLibreMap): void {
  const m = map as unknown as { transform?: unknown; _camera?: { transform?: unknown } }
  if (m.transform || !m._camera?.transform) return
  Object.defineProperty(map, 'transform', {
    get: () => (map as unknown as { _camera: { transform: unknown } })._camera.transform,
    configurable: true,
  })
}

export function createMap(container: string, state: AppState): MapLibreMap {
  const protocol = new Protocol()
  addProtocol('pmtiles', protocol.tile)

  const map = new MapLibreMap({
    container,
    style: getBasemapStyle(state.basemap, state.theme),
    center: [138.5, 37.5],
    zoom: 4.5,
    // 既定の上限は60。震源の深さを断面のように見るには浅すぎるので上げる。
    // maplibre は 60 超を experimental としているが、地形を使っていないので影響は小さい。
    maxPitch: 85,
    hash: true,
    attributionControl: false,
    // モバイルのGPU・メモリ逼迫対策
    maxTileCacheSize: isMobile ? 24 : undefined,
    pixelRatio: isMobile ? Math.min(window.devicePixelRatio || 1, 2) : undefined,
  })

  exposeTransform(map)

  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
  map.addControl(new FullscreenControl(), 'top-right')
  map.addControl(
    new GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
    }),
    'top-right')
  map.addControl(new ScaleControl({ maxWidth: 200, unit: 'metric' }), 'bottom-left')
  map.addControl(
    new AttributionControl({ compact: true, customAttribution: ATTRIBUTION }),
    'bottom-right')

  return map
}
