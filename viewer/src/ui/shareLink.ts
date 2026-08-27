import { toast } from './toast'

/**
 * クリップボードAPIが使えない場合の写し取り。
 * httpsでない配信や、権限を拒否された場合に落ちる。
 */
function legacyCopy(text: string): boolean {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  // 画面を動かさずに選択させる
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.opacity = '0'
  document.body.append(ta)
  ta.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  ta.remove()
  return ok
}

/**
 * いま見えている画面のURLをクリップボードへ写す。
 * URLの中身は lib/urlState.ts が常に最新に保っているので、ここは写すだけでよい。
 */
export function createShareLink(): void {
  const btn = document.getElementById('share-btn') as HTMLButtonElement | null
  if (!btn) return

  btn.addEventListener('click', async () => {
    const url = location.href
    try {
      await navigator.clipboard.writeText(url)
      toast('URLをコピーしました')
      return
    } catch {
      // クリップボードAPIが使えない環境。下の手で写す。
    }
    toast(legacyCopy(url) ? 'URLをコピーしました' : 'コピーできませんでした。アドレスバーからコピーしてください')
  })
}
