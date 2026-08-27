// MapLibre本体のCSSを先に読む。後に来ると .maplibregl-popup-content の
// background:#fff などが同じ詳細度で自前の上書きに勝ってしまい、
// ダークテーマのポップアップが白背景＋白文字になって読めなくなる。
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

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
import { createDepth3dToggle } from './ui/depth3dToggle'
import { createLayerPanel } from './ui/layerPanel'
import { createPanel } from './ui/panel'
import { createThemeToggle } from './ui/themeToggle'

// 地図の位置はMapLibreの hash が握る。createMap を通すと即座に書き込まれるため、
// 「利用者がURLで位置を指定して来たか」はその前に見ておく必要がある。
const hasInitialHash = window.location.hash.length > 1

// 状態はstoreに1本化する。UIも地図もこれを購読するだけで、互いを直接書き換えない。
const store = createAppStore()
const map = createMap('map', store.get())

createDataLayers(map, store)
createEventCamera(map, store, hasInitialHash)
createInteractions(map, store)
createHypocenter3d(map, store)
createBasemapDim(map, store)
createPopup(map, store)
createBasemapSwitch(map, store)
createThemeToggle(store)
createPanel()
createEventSearch(store)
createLayerPanel(store)
createDepth3dToggle(map, store)
createDatasetInfo()

const buildEl = document.getElementById('build-ver')
if (buildEl) buildEl.textContent = __BUILD_TIME__

// デバッグ用
Object.assign(window, { __map: map, __store: store })
