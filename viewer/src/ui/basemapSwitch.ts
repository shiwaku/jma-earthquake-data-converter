import type { IControl, Map as MapLibreMap } from 'maplibre-gl'
import type { Basemap } from '../map/basemap'
import type { AppStore } from '../state'

const CHOICES: [Basemap, string][] = [
  ['pale', '地図'],
  ['photo', '写真'],
]

/** 背景地図スイッチャー（右下）。 */
export function createBasemapSwitch(map: MapLibreMap, store: AppStore): void {
  class Control implements IControl {
    private el!: HTMLElement

    onAdd(): HTMLElement {
      this.el = document.createElement('div')
      this.el.className = 'maplibregl-ctrl basemap-switch'
      for (const [base, label] of CHOICES) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = label
        btn.dataset.base = base
        btn.addEventListener('click', () => store.set({ basemap: base }))
        this.el.append(btn)
      }
      this.sync()
      return this.el
    }

    onRemove(): void {
      this.el.remove()
    }

    sync(): void {
      const current = store.get().basemap
      for (const btn of this.el.querySelectorAll<HTMLButtonElement>('button')) {
        btn.setAttribute('aria-selected', String(btn.dataset.base === current))
      }
    }
  }

  const control = new Control()
  map.addControl(control, 'bottom-right')

  store.subscribe((s, prev) => {
    if (s.basemap !== prev.basemap) control.sync()
  })
}
