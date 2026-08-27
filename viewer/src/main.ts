// MapLibre本体のCSSを先に読む。後に来ると .maplibregl-popup-content の
// background:#fff などが同じ詳細度で自前の上書きに勝ってしまい、
// ダークテーマのポップアップが白背景＋白文字になって読めなくなる。
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

import { createUrlState, hasMapInUrl, migrateLegacyHash, readUrlState } from './lib/urlState'
import { createBasemapDim } from './map/basemapDim'
import { createDataLayers } from './map/dataLayers'
import { createEventCamera } from './map/eventCamera'
import { createHypocenter3d } from './map/hypocenter3d'
import { createInteractions } from './map/interactions'
import { createPopup } from './map/popup'
import { createMap } from './map/createMap'
import { createAppStore } from './state'
import { createBasemapSwitch } from './ui/basemapSwitch'
import { createDatasetInfo } from './ui/datasetInfo'
import { createEventSearch } from './ui/eventSearch'
import { createDepth3dAuto } from './ui/depth3dAuto'
import { createLayerPanel } from './ui/layerPanel'
import { createPanel } from './ui/panel'
import { createShareLink } from './ui/shareLink'
import { createThemeToggle } from './ui/themeToggle'

// 旧形式（`#5.25/32.365/134.8/0/61`）のリンクを名前付きへ直す。地図を作る前に行う。
migrateLegacyHash()

// 地図の位置はMapLibreの hash が握る。createMap を通すと即座に書き込まれるため、
// 「利用者がURLで位置を指定して来たか」はその前に見ておく必要がある。
const hasInitialHash = hasMapInUrl()

// 状態はstoreに1本化する。UIも地図もこれを購読するだけで、互いを直接書き換えない。
// URLに入っている分だけ初期値を上書きする。
const store = createAppStore(readUrlState())
const map = createMap('map', store.get())

createDataLayers(map, store)
createEventCamera(map, store, hasInitialHash)
// 震源の点はクリック判定も持つ。interactions はその口を受け取る。
const hypocenter3d = createHypocenter3d(map, store)
createInteractions(map, store, hypocenter3d)
createBasemapDim(map, store)
createPopup(map, store)
createBasemapSwitch(map, store)
createThemeToggle(store)
createPanel()
createEventSearch(store)
createLayerPanel(store)
createDepth3dAuto(map, store)
createDatasetInfo()
createShareLink()
createUrlState(map, store)

const buildEl = document.getElementById('build-ver')
if (buildEl) buildEl.textContent = __BUILD_TIME__

// PWA。開発時は登録しない。ビルド前のファイルがキャッシュに残ると
// 次に開いたとき古いものが出てしまうため。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = (): void => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  }
  // 初回表示の帯域を奪わないよう load を待つ。ただし、そのときすでに
  // 読み終わっていると load は二度と来ないので、その場で登録する。
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register)
}

// デバッグ用
Object.assign(window, { __map: map, __store: store })
