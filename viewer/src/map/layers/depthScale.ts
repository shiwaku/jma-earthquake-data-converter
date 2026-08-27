import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * 震源の深さの配色。浅いほど暖色、深いほど寒色という地震学の慣例に合わせる。
 *
 * **明度ではなく色相を回す。** ぼかした小さな発光点では明度差がにじんで潰れるため
 * （姉妹リポジトリ jma-liden-tile-pipeline の実測メモに合わせた）。
 *
 * **刻みは等間隔にしない。** 実データ（5,077,119件）の分布が浅部に強く偏っており、
 * 0-30kmに67.7%、中央値14km、p95が84.2km、最大698.4km。
 * 0-700kmを線形に塗ると95%が同じ色に潰れるので、浅部に刻みを寄せてある。
 */
export const DEPTH_STOPS: Array<[number, string]> = [
  [0, '#ff2d2d'],
  [10, '#ff7a1a'],
  [20, '#ffc247'],
  [40, '#c8e04a'],
  [70, '#3fd06a'],
  [150, '#2bc4d4'],
  [300, '#3b74ff'],
  [700, '#9b4bff'],
]

/** 深さが無い震源に使う色。 */
const UNKNOWN_DEPTH = '#8896b4'

/**
 * 深さから色を作る式。
 * 深さが無い（空文字）場合に interpolate へ渡すと式全体が無効になるため、
 * has で存在を確かめてから数値化する。
 */
export function depthColorExpression(): ExpressionSpecification {
  const stops = DEPTH_STOPS.flatMap(([depth, color]) => [depth, color])
  return [
    'case',
    ['has', '深さ(km)'],
    ['interpolate', ['linear'], ['to-number', ['get', '深さ(km)'], 0], ...stops],
    UNKNOWN_DEPTH,
  ] as unknown as ExpressionSpecification
}

/** 凡例のグラデーション。刻みが非線形なので、目盛りも実際の位置に合わせて置く。 */
export function depthLegendCss(): string {
  const max = DEPTH_STOPS[DEPTH_STOPS.length - 1][0]
  const stops = DEPTH_STOPS.map(([depth, color]) => `${color} ${(depth / max) * 100}%`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** 目盛り。全部出すと詰まるので代表的な深さだけ。 */
export function depthLegendTicks(): { pos: number; label: string }[] {
  const max = DEPTH_STOPS[DEPTH_STOPS.length - 1][0]
  return [0, 70, 300, 700].map((depth) => ({
    pos: (depth / max) * 100,
    label: depth === 0 ? '0km' : `${depth}`,
  }))
}
