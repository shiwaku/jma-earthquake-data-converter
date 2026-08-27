/** HTML に埋め込む文字列のエスケープ。 */
export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
}

/** 属性値を文字列で取り出す。未設定・null・空文字はすべて空文字に潰す。 */
export function prop(p: Record<string, unknown>, key: string): string {
  const v = p[key]
  return v === undefined || v === null || v === '' ? '' : String(v)
}

/** 定義リストの1行。値が空なら行ごと出さない。 */
export function row(label: string, value: string, strong = false): string {
  if (!value) return ''
  return `<dt>${esc(label)}</dt><dd${strong ? ' class="pp-strong"' : ''}>${esc(value)}</dd>`
}

/**
 * 座標と外部地図サービスへのリンク。
 * 既定はクリック地点だが、地物そのものの座標を出す場合は label を差し替える。
 */
export function coordFooter(lng: number, lat: number, label = 'クリック位置'): string {
  const q = `${lat},${lng}`
  return (
    `<div class="pp-foot">座標: ${lat.toFixed(7)}, ${lng.toFixed(7)}（${esc(label)}）<br />` +
    `<a href="https://www.google.com/maps?q=${q}&hl=ja" target="_blank" rel="noopener">🌎 Google Maps</a> ` +
    `<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${q}&hl=ja" target="_blank" rel="noopener">📷 Street View</a></div>`
  )
}
