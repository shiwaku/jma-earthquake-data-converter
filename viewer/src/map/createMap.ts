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
import 'maplibre-gl/dist/maplibre-gl.css'

import { isMobile } from '../lib/env'
import type { AppState } from '../state'
import { getBasemapStyle } from './basemap'

setWorkerUrl(workerUrl)

const ATTRIBUTION =
  '<a href="https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html" target="_blank" rel="noreferrer">気象庁 地震月報(カタログ編)</a>'

export function createMap(container: string, state: AppState): MapLibreMap {
  const protocol = new Protocol()
  addProtocol('pmtiles', protocol.tile)

  const map = new MapLibreMap({
    container,
    style: getBasemapStyle(state.basemap, state.theme),
    center: [138.5, 37.5],
    zoom: 4.5,
    hash: true,
    attributionControl: false,
    // モバイルのGPU・メモリ逼迫対策
    maxTileCacheSize: isMobile ? 24 : undefined,
    pixelRatio: isMobile ? Math.min(window.devicePixelRatio || 1, 2) : undefined,
  })

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
