import type { ExpressionSpecification } from 'maplibre-gl'

/** 気象庁の震度階級と配色。 */

export interface ShindoClass {
  /** データ上の値。1996年の階級改定前は 5/6、改定後は 5-/5+/6-/6+ が入る。 */
  code: string
  label: string
  color: string
}

export const SHINDO_CLASSES: ShindoClass[] = [
  { code: '1', label: '震度1', color: 'rgb(255, 255, 255)' },
  { code: '2', label: '震度2', color: 'rgb(0, 170, 255)' },
  { code: '3', label: '震度3', color: 'rgb(0, 65, 255)' },
  { code: '4', label: '震度4', color: 'rgb(250, 230, 150)' },
  { code: '5', label: '震度5（旧階級）', color: 'rgb(250, 230, 0)' },
  { code: '5-', label: '震度5弱', color: 'rgb(250, 230, 0)' },
  { code: '5+', label: '震度5強', color: 'rgb(255, 153, 0)' },
  { code: '6', label: '震度6（旧階級）', color: 'rgb(255, 40, 0)' },
  { code: '6-', label: '震度6弱', color: 'rgb(255, 40, 0)' },
  { code: '6+', label: '震度6強', color: 'rgb(165, 0, 33)' },
  { code: '7', label: '震度7', color: 'rgb(180, 0, 140)' },
]

/** 該当しない値（9:有感だが階級不明 など）は描画しない。 */
export const SHINDO_FALLBACK = 'rgba(0, 0, 0, 0)'

/**
 * 震度階級で塗り分ける match 式。
 * 可変長のスプレッドは型推論が通らないため、ここで一度だけ型を確定させる。
 */
export function shindoColorExpression(): ExpressionSpecification {
  const stops = SHINDO_CLASSES.flatMap((c) => [c.code, c.color])
  return ['match', ['get', '震度'], ...stops, SHINDO_FALLBACK] as unknown as ExpressionSpecification
}

/** 震源データの最大震度は '5弱'、震度データは '5-' を使う。前者を後者に寄せる。 */
const SHINDO_ALIAS: Record<string, string> = {
  '5弱': '5-', '5強': '5+', '6弱': '6-', '6強': '6+',
}

/** 震度階級の色。該当しない値では透明を返す。 */
export function shindoColor(value: string): string {
  const code = SHINDO_ALIAS[value] ?? value
  return SHINDO_CLASSES.find((c) => c.code === code)?.color ?? SHINDO_FALLBACK
}

/**
 * 震度の色の上に置く文字色。震度1（白）から震度7（濃い赤紫）まで明度の幅が
 * 大きいため、相対輝度で白黒を選ぶ。
 */
export function shindoInk(value: string): string {
  const rgb = /(\d+)\D+(\d+)\D+(\d+)/.exec(shindoColor(value))
  if (!rgb) return 'inherit'
  const [r, g, b] = rgb.slice(1, 4).map(Number)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#14161a' : '#ffffff'
}
