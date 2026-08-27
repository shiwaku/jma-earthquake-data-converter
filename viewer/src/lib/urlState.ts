import type { Map as MapLibreMap } from 'maplibre-gl'

import type { Basemap } from '../map/basemap'
import { LAYERS } from '../map/layers/registry'
import type { AppState, AppStore, LayerState } from '../state'

/**
 * 表示状態をURLのハッシュに載せる。開いている画面をそのままURLで渡せるようにする。
 *
 * 地図の位置は MapLibre の hash が `map=z/lat/lng/bearing/pitch` として書く
 * （createMap の `hash: 'map'`）。こちらはその隣に自前のキーを足す。
 * MapLibre は書くときに現在のハッシュを読み直して自分のキーだけ差し替えるので、
 * 互いを消し合わない。どちらも replaceState なので履歴も汚さない。
 *
 *   #map=5.25/32.365/134.8/0/61&theme=dark&bm=photo&l=unfelt:0.8
 *
 * 立体表示（depth3d）と背景の減光は載せない。前者は常時ON、後者は傾きから決まる。
 */

const MAP = 'map'
const THEME = 'theme'
const BASEMAP = 'bm'
const LAYERS_KEY = 'l'

function hashParams(): URLSearchParams {
  return new URLSearchParams(location.hash.replace('#', ''))
}

/**
 * ハッシュを書き戻す。
 * URLSearchParams のままだと `/` や `:` が %2F・%3A になって読めなくなるため、
 * MapLibre 側の整形（decodeURIComponent と裸のキーの後始末）に合わせる。
 */
function writeParams(params: URLSearchParams): void {
  const hash = decodeURIComponent(params.toString()).replace(/=&/g, '&').replace(/=$/g, '')
  history.replaceState(history.state, '', `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`)
}

/**
 * 旧形式のリンクを読めるようにする。
 *
 * 以前は MapLibre の `hash: true` で `#5.25/32.365/134.8/0/61` と書いていた。
 * 名前付きに変えると `map=` が無い分そのままでは無視され、既定の位置に飛ぶ。
 * 外に出ているリンクが死ぬので、地図を作る前に名前付きへ直す。
 */
export function migrateLegacyHash(): void {
  const raw = location.hash.replace('#', '')
  if (!raw || raw.includes('=')) return
  const parts = raw.split('/')
  if (parts.length < 3 || parts.some((p) => p === '' || Number.isNaN(Number(p)))) return
  const params = hashParams()
  // 裸の `z/lat/lng/...` は URLSearchParams では「値のないキー」として入っている
  params.delete(raw)
  params.set(MAP, raw)
  writeParams(params)
}

/** URLに地図の位置が入っているか。初回の既定選択でそれを上書きしないための判断に使う。 */
export function hasMapInUrl(): boolean {
  return hashParams().has(MAP)
}

function parseLayers(value: string): Record<string, LayerState> {
  // `key:opacity` の並び。opacity は省略可。並びに無いレイヤーは非表示とみなす。
  const wanted = new Map<string, number | undefined>()
  for (const part of value.split(',')) {
    if (!part) continue
    const [key, op] = part.split(':')
    const n = Number(op)
    wanted.set(key, op !== undefined && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : undefined)
  }
  const layers: Record<string, LayerState> = {}
  for (const mod of LAYERS) {
    const key = mod.def.key
    layers[key] = {
      visible: wanted.has(key),
      opacity: wanted.get(key) ?? mod.def.defaultOpacity,
    }
  }
  return layers
}

function encodeLayers(layers: Record<string, LayerState>): string {
  return LAYERS.filter((mod) => layers[mod.def.key]?.visible)
    .map((mod) => {
      const s = layers[mod.def.key]
      // 既定の不透明度なら書かない。URLを短く保つ。
      return s.opacity === mod.def.defaultOpacity ? mod.def.key : `${mod.def.key}:${s.opacity}`
    })
    .join(',')
}

/** URLに入っている状態。store の初期値に混ぜて使う。 */
export function readUrlState(): Partial<AppState> {
  const params = hashParams()
  const state: Partial<AppState> = {}

  const theme = params.get(THEME)
  if (theme === 'dark' || theme === 'light') state.theme = theme

  const basemap = params.get(BASEMAP)
  if (basemap === 'pale' || basemap === 'photo') state.basemap = basemap as Basemap

  const layers = params.get(LAYERS_KEY)
  if (layers !== null) state.layers = parseLayers(layers)

  return state
}

/** 状態が変わるたびURLを書き換える。 */
export function createUrlState(map: MapLibreMap, store: AppStore): void {
  function write(state: AppState): void {
    const params = hashParams()
    params.set(THEME, state.theme)
    params.set(BASEMAP, state.basemap)
    params.set(LAYERS_KEY, encodeLayers(state.layers))
    writeParams(params)
  }

  store.subscribe((s, prev) => {
    if (s.theme !== prev.theme || s.basemap !== prev.basemap || s.layers !== prev.layers) write(s)
  })

  write(store.get())

  // MapLibre は moveend でしか位置を書かない。一度も動かさずに共有されると
  // 位置の無いURLになるため、最初の1回はこちらから書かせる。
  // throttle は先頭で実行するので、この場で入る。
  if (!hasMapInUrl()) map.fire('moveend')
}
