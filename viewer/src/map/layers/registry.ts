// import { didLayer } from './did'
// import { hypocenterLayer } from './hypocenter'
// import { shindoLayer } from './shindo'
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
// いまは震源（無感含む）だけを出している。戻すときは import とこの配列の
// 両方のコメントを解除する。配列順が z順とパネルの並び順を兼ねるため、
// 面である人口集中地区は先頭、点の震度は末尾という順序を維持すること。
export const LAYERS: LayerModule[] = [/* didLayer, */ unfeltLayer /*, hypocenterLayer, shindoLayer */]

/**
 * あるレイヤーを有効にしたとき、一緒に有効にするレイヤー。
 *
 * 震源（有感のみ）だけを出しても地震の位置が分かるだけで、その地震で
 * どこがどれだけ揺れたかは見えない。両方そろって初めて意味を持つため連動させる。
 * 無効にするときは連動しない。片方だけ見たい場面があるため。
 */
export const LAYER_LINKS: Record<string, string[]> = {
  hypocenter: ['shindo'],
}

export function layerByKey(key: string): LayerModule | undefined {
  return LAYERS.find((m) => m.def.key === key)
}

export function layerByPickId(id: string): LayerModule | undefined {
  return LAYERS.find((m) => m.pickLayerId === id)
}
