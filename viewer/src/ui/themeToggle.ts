import type { AppStore } from '../state'
import type { Theme } from '../theme'

/** テーマ切替ボタンと <html data-theme="…"> の同期。 */
export function createThemeToggle(store: AppStore): void {
  const btn = document.getElementById('theme-btn') as HTMLButtonElement

  function apply(theme: Theme): void {
    document.documentElement.dataset.theme = theme
    btn.textContent = theme === 'dark' ? '☀️' : '🌙'
  }

  btn.addEventListener('click', () => {
    store.set({ theme: store.get().theme === 'dark' ? 'light' : 'dark' })
  })

  store.subscribe((s, prev) => {
    if (s.theme !== prev.theme) apply(s.theme)
  })

  apply(store.get().theme)
}
