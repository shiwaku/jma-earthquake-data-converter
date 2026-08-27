import { didLayer } from './did'
import { hypocenterLayer } from './hypocenter'
import { shindoLayer } from './shindo'
import { unfeltLayer } from './unfelt'
import type { LayerModule } from './types'

/**
 * 描画対象レイヤー。パネルの並び順（先頭＝一番上）。
 * dataLayers がこの配列順に addLayer するため、配列末尾ほど地図で最前面。
 * 面である人口集中地区を背面に、数の多い無感地震、点である震度、記号である震源の順に前面へ置く。
 *
 * レイヤーを増やすときは、layers/ にモジュールを1枚書いてこの配列に足すだけでよい。
 */
export const LAYERS: LayerModule[] = [didLayer, unfeltLayer, shindoLayer, hypocenterLayer]

export function layerByKey(key: string): LayerModule | undefined {
  return LAYERS.find((m) => m.def.key === key)
}

export function layerByPickId(id: string): LayerModule | undefined {
  return LAYERS.find((m) => m.pickLayerId === id)
}
