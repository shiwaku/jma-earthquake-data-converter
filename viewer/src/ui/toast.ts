/**
 * 短い通知。操作が通ったことだけを伝える用途に絞る。
 * 消えるまで待たせないので、失敗の説明には使わない。
 */
let timer: number | undefined

export function toast(message: string): void {
  const el = document.getElementById('toast')
  if (!el) return
  el.textContent = message
  el.classList.add('is-open')
  clearTimeout(timer)
  timer = window.setTimeout(() => el.classList.remove('is-open'), 2000)
}
