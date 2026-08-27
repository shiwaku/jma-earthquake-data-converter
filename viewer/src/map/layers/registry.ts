import { didLayer } from './did'
import { hypocenterLayer } from './hypocenter'
import { shindoLayer } from './shindo'
import { unfeltLayer } from './unfelt'
import type { LayerModule } from './types'

/**
 * 描画対象レイヤー。パネルの並び順（先頭＝一番上）。
 * dataLayers がこの配列順に addLayer するため、配列末尾ほど地図で最前面。
 *
 * 地震の3レイヤーは 無感震源 → 有感震源 → 震度 の順に前面へ置く。
 * 件数の多い無感震源を背面に敷き、選択した地震の震源と震度をその上に重ねる。
 * 面である人口集中地区は最背面に置くため配列の先頭に固定する。
 *
 * レイヤーを増やすときは、layers/ にモジュールを1枚書いてこの配列に足すだけでよい。
 */
export const LAYERS: LayerModule[] = [didLayer, unfeltLayer, hypocenterLayer, shindoLayer]

export function layerByKey(key: string): LayerModule | undefined {
  return LAYERS.find((m) => m.def.key === key)
}

export function layerByPickId(id: string): LayerModule | undefined {
  return LAYERS.find((m) => m.pickLayerId === id)
}
