import { createStore, type Store } from './lib/store'
import type { Basemap } from './map/basemap'
import { LAYERS } from './map/layers/registry'
import type { Theme } from './theme'

export interface LayerState {
  visible: boolean
  opacity: number
}

export interface Selection {
  layerKey: string
  properties: Record<string, unknown>
  lng: number
  lat: number
}

export interface AppState {
  /** 表示中の地震ID。未選択なら null。 */
  eventId: string | null
  theme: Theme
  basemap: Basemap
  layers: Record<string, LayerState>
  selection: Selection | null
  /** 震源を深さで立体表示するモード。 */
  depth3d: boolean
}

export type AppStore = Store<AppState>

const THEME_KEY = 'jma-earthquake-viewer:theme'

/** 既定はダーク。震源の点や震度の色が背景に埋もれず、深さの3D表示も見やすい。 */
function savedTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

function defaultLayers(): Record<string, LayerState> {
  const layers: Record<string, LayerState> = {}
  for (const mod of LAYERS) {
    layers[mod.def.key] = { visible: mod.def.defaultVisible, opacity: mod.def.defaultOpacity }
  }
  return layers
}

export function createAppStore(initial: Partial<AppState> = {}): AppStore {
  const store = createStore<AppState>({
    eventId: null,
    theme: savedTheme(),
    basemap: 'pale',
    layers: defaultLayers(),
    selection: null,
    depth3d: false,
    ...initial,
  })

  // テーマだけは次回訪問に引き継ぐ
  store.subscribe((state, prev) => {
    if (state.theme !== prev.theme) localStorage.setItem(THEME_KEY, state.theme)
  })

  return store
}

/**
 * layers は丸ごと差し替える。購読側が参照の変化だけで気づけるようにするため。
 */
export function setLayerState(store: AppStore, key: string, patch: Partial<LayerState>): void {
  const current = store.get().layers
  store.set({ layers: { ...current, [key]: { ...current[key], ...patch } } })
}
