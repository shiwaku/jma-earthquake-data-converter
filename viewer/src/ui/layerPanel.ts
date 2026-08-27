import { LAYER_LINKS, LAYERS } from '../map/layers/registry'
import type { LayerModule } from '../map/layers/types'
import { setLayerState, type AppStore } from '../state'
import { legendMarkup } from './legend'

/** レイヤーの ON/OFF・不透明度・説明・凡例。凡例は各レイヤー直下にインライン表示する。 */
export function createLayerPanel(store: AppStore): void {
  const root = document.getElementById('layers') as HTMLElement

  interface Row {
    check: HTMLInputElement
    range: HTMLInputElement
    opValue: HTMLElement
    opacityBox: HTMLElement
    legend: HTMLElement
  }
  const rows = new Map<string, Row>()

  for (const mod of LAYERS) rows.set(mod.def.key, buildRow(mod))

  function buildRow(mod: LayerModule): Row {
    const { key, name, desc } = mod.def
    const initial = store.get().layers[key]

    const item = document.createElement('div')
    item.className = 'layer-item'
    item.dataset.key = key

    const label = document.createElement('label')
    label.className = 'toggle'

    const check = document.createElement('input')
    check.type = 'checkbox'
    check.checked = initial.visible
    check.addEventListener('change', () => {
      setLayerState(store, key, { visible: check.checked })
      // 有効にしたときだけ、連動先も一緒に出す。
      if (!check.checked) return
      for (const linked of LAYER_LINKS[key] ?? []) {
        if (!store.get().layers[linked]?.visible) setLayerState(store, linked, { visible: true })
      }
    })

    const sw = document.createElement('span')
    sw.className = 'switch'
    const text = document.createElement('span')
    text.className = 't-label'
    text.textContent = name

    // レイヤーの説明（i ボタンで開閉）
    const descEl = document.createElement('div')
    descEl.className = 'layer-desc'
    descEl.hidden = true
    descEl.textContent = desc

    const info = document.createElement('button')
    info.type = 'button'
    info.className = 'info-btn'
    info.textContent = 'i'
    info.setAttribute('aria-label', `${name}の説明`)
    info.setAttribute('aria-expanded', 'false')
    info.addEventListener('click', (e) => {
      // label 内のボタン。クリックが checkbox のトグルへ波及しないようにする
      e.preventDefault()
      e.stopPropagation()
      const open = descEl.hidden
      descEl.hidden = !open
      info.setAttribute('aria-expanded', String(open))
    })

    label.append(check, sw, text, info)

    // 不透明度スライダー（有効時のみ表示）
    const opacityBox = document.createElement('div')
    opacityBox.className = 'layer-opacity'
    opacityBox.hidden = !initial.visible
    const range = document.createElement('input')
    range.type = 'range'
    range.min = '0'
    range.max = '1'
    range.step = '0.05'
    range.value = String(initial.opacity)
    range.setAttribute('aria-label', `${name}の不透明度`)
    const opValue = document.createElement('span')
    opValue.className = 'op-val'
    opValue.textContent = percent(initial.opacity)
    range.addEventListener('input', () => setLayerState(store, key, { opacity: Number(range.value) }))
    opacityBox.append(range, opValue)

    const legend = document.createElement('div')
    legend.className = 'layer-legend'
    legend.hidden = !initial.visible

    item.append(label, descEl, opacityBox, legend)
    root.append(item)

    return { check, range, opValue, opacityBox, legend }
  }

  function percent(v: number): string {
    return `${Math.round(v * 100)}%`
  }

  function render(): void {
    const { layers, eventId, theme } = store.get()
    for (const mod of LAYERS) {
      const row = rows.get(mod.def.key)
      if (!row) continue
      const s = layers[mod.def.key]
      row.check.checked = s.visible
      row.opacityBox.hidden = !s.visible
      if (row.range.value !== String(s.opacity)) row.range.value = String(s.opacity)
      row.opValue.textContent = percent(s.opacity)
      // 連続量のグラデーション凡例はタイムバーが持つ（パネルを畳んでも読めるように）。
      // ここに出すのはカテゴリの色見本だけ。テーマで配色が変わるので毎回作り直す。
      // カテゴリの色見本も連続量のグラデーションも、どちらもトグルの直下に出す。
      // 参考実装はグラデーションをタイムバーに逃がしていたが、こちらにタイムバーはない。
      const legend = mod.legend({ eventId, theme })
      row.legend.innerHTML = legendMarkup(legend)
      row.legend.hidden = !s.visible
    }
  }

  store.subscribe((s, prev) => {
    if (s.layers !== prev.layers || s.theme !== prev.theme) render()
  })

  render()
}
