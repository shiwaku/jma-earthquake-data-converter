import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * 震源の深さの配色。**このファイルが唯一の出どころ**で、3Dの点群（map/hypocenter3d.ts）も
 * 2Dの式も、パネルと地図の凡例もここから作る。別々に持つと配色がずれる。
 *
 * 参考実装 nagix/japan-eq-locator に合わせてある。
 *
 *   const colorScale = d3.scaleSequential([0, -500000], d3.interpolateSpectral)
 *
 * すなわち **0〜500kmを線形** に ColorBrewer の Spectral（11段階）で塗り、
 * 500kmより深いものは端の色に張り付く。浅いほど暖色、深いほど寒色という
 * 地震学の慣例どおりの向き。
 *
 * 実データは浅部に強く偏っており（中央値14km、95%が84kmより浅い、最大698km）、
 * 線形だと96%が左端14%（0〜70km）の赤〜橙に収まる。それでも参考実装に合わせるのは、
 * 沈み込むプレートの形が青〜紫ではっきり分かれて見えるため。
 */
const SPECTRAL: [number, number, number][] = [
  [158, 1, 66],
  [213, 62, 79],
  [244, 109, 67],
  [253, 174, 97],
  [254, 224, 139],
  [255, 255, 191],
  [230, 245, 152],
  [171, 221, 164],
  [102, 194, 165],
  [50, 136, 189],
  [94, 79, 162],
]

/** 色が張り付く深さ(km)。これより深いものは最後の色になる。 */
export const DEPTH_MAX = 500

/** [深さ(km), 色] の並び。0〜DEPTH_MAX を等間隔に割る。 */
export const DEPTH_STOPS: Array<[number, [number, number, number]]> = SPECTRAL.map(
  (color, i) => [(DEPTH_MAX / (SPECTRAL.length - 1)) * i, color],
)

function hex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** 深さ(km)に対応する色。区間ごとに線形補間する。 */
export function depthColor(km: number): [number, number, number] {
  const d = Math.max(0, km)
  for (let i = 1; i < DEPTH_STOPS.length; i++) {
    const [d1, c1] = DEPTH_STOPS[i - 1]
    const [d2, c2] = DEPTH_STOPS[i]
    if (d <= d2) {
      const k = (d - d1) / (d2 - d1)
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * k),
        Math.round(c1[1] + (c2[1] - c1[1]) * k),
        Math.round(c1[2] + (c2[2] - c1[2]) * k),
      ]
    }
  }
  return DEPTH_STOPS[DEPTH_STOPS.length - 1][1]
}

/** 深さが無い震源に使う色。 */
const UNKNOWN_DEPTH = '#8896b4'

/**
 * 深さから色を作る式。
 * 深さが無い（空文字）場合に interpolate へ渡すと式全体が無効になるため、
 * has で存在を確かめてから数値化する。
 */
export function depthColorExpression(): ExpressionSpecification {
  const stops = DEPTH_STOPS.flatMap(([depth, color]) => [depth, hex(color)])
  return [
    'case',
    ['has', '深さ(km)'],
    ['interpolate', ['linear'], ['to-number', ['get', '深さ(km)'], 0], ...stops],
    UNKNOWN_DEPTH,
  ] as unknown as ExpressionSpecification
}

/** 凡例のグラデーション（CSS）。 */
export function depthLegendCss(): string {
  const stops = DEPTH_STOPS.map(([depth, color]) => `${hex(color)} ${((depth / DEPTH_MAX) * 100).toFixed(1)}%`)
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

/** 目盛り。等間隔なので全部は出さず、100kmごとに置く。 */
export function depthLegendTicks(): { pos: number; label: string }[] {
  return [0, 100, 200, 300, 400, 500].map((depth) => ({
    pos: (depth / DEPTH_MAX) * 100,
    label: depth === 0 ? '0km' : depth === DEPTH_MAX ? `${depth}km` : `${depth}`,
  }))
}
