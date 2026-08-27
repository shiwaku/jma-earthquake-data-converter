import { isMobile } from '../lib/env'

/** コントロールパネルの開閉。スマホでは初期状態で畳んで地図を広く見せる。 */
export function createPanel(): void {
  const panel = document.getElementById('panel') as HTMLElement
  const btn = document.getElementById('collapse-btn') as HTMLButtonElement

  function render(): void {
    btn.textContent = panel.classList.contains('collapsed') ? '▾' : '▴'
  }

  btn.addEventListener('click', () => {
    panel.classList.toggle('collapsed')
    render()
  })

  if (isMobile) panel.classList.add('collapsed')
  render()
}
