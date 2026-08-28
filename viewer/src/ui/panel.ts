import { isMobile } from '../lib/env'

/** コントロールパネルの開閉。スマホでは初期状態で畳んで地図を広く見せる。 */
export function createPanel(): void {
  const panel = document.getElementById('panel') as HTMLElement
  const btn = document.getElementById('collapse-btn') as HTMLButtonElement

  function render(): void {
    const collapsed = panel.classList.contains('collapsed')
    btn.textContent = collapsed ? '▾' : '▴'
    // 地図上の凡例の出し分けに使う。パネルが開いていればパネル側に凡例が出ており、
    // 地図にも出すと同じものが2つ並ぶ。
    document.body.classList.toggle('panel-collapsed', collapsed)
  }

  btn.addEventListener('click', () => {
    panel.classList.toggle('collapsed')
    render()
  })

  if (isMobile) panel.classList.add('collapsed')
  render()
}
