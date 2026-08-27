import {
  DEFAULT_EVENT_ID,
  loadEventIndex,
  searchEvents,
  type EventIndex,
  type EventRecord,
} from '../lib/events'
import { esc } from '../lib/format'
import { shindoColor, shindoInk } from '../map/layers/shindoScale'
import type { AppStore } from '../state'

/** 一度に描く行数の上限。「熊本」で数百件当たることがあるため頭打ちにする。 */
const MAX_ROWS = 200

/**
 * 地震の検索と選択。旧ビューワは14件のプルダウンだったが、ここでは
 * 最大震度3以上の全件（15,480件）から選べる。
 * 選んだ結果は store の eventId に入れるだけで、地図の絞り込みもカメラも
 * それを購読している側が行う。
 */
export function createEventSearch(store: AppStore): void {
  const input = document.getElementById('event-q') as HTMLInputElement
  const list = document.getElementById('event-list') as HTMLElement
  const status = document.getElementById('event-status') as HTMLElement
  const current = document.getElementById('event-current') as HTMLElement

  let index: EventIndex | null = null

  input.disabled = true
  status.textContent = '地震の一覧を読み込んでいます…'

  loadEventIndex()
    .then((idx) => {
      index = idx
      input.disabled = false
      renderList()
      renderCurrent()
      // 初回は旧ビューワと同じ1923年関東地震を出す。何も選ばれていないと
      // 震度・震源は地震IDで絞られる以上、地図が空のままになる。
      if (!store.get().eventId) store.set({ eventId: DEFAULT_EVENT_ID })
    })
    .catch((err: unknown) => {
      status.textContent = '地震の一覧を読み込めませんでした'
      console.error(err)
    })

  function summary(e: EventRecord): string {
    const parts = []
    if (e.mag !== null) parts.push(`M${e.mag.toFixed(1)}`)
    if (e.depth !== null) parts.push(`深さ${Math.round(e.depth)}km`)
    parts.push(`${e.stations}観測点`)
    return parts.join('　')
  }

  function badge(e: EventRecord): string {
    return (
      `<span class="ev-shindo" style="background:${shindoColor(e.shindo)};color:${shindoInk(e.shindo)}">` +
      `震度${esc(e.shindo)}</span>`
    )
  }

  function rowHtml(e: EventRecord, selected: boolean): string {
    return (
      `<li><button type="button" class="ev-row" data-id="${e.id}"` +
      `${selected ? ' aria-current="true"' : ''}>` +
      `<span class="ev-head">${badge(e)}<span class="ev-name">${esc(e.name)}</span></span>` +
      `<span class="ev-date">${esc(e.label)}</span>` +
      `<span class="ev-meta">${esc(summary(e))}</span>` +
      `</button></li>`
    )
  }

  function renderList(): void {
    if (!index) return
    const { eventId } = store.get()
    const { rows, total, notable } = searchEvents(index, input.value, MAX_ROWS)

    list.innerHTML = rows.map((e) => rowHtml(e, e.id === eventId)).join('')

    if (notable) {
      status.textContent = `主な地震（全${index.all.length.toLocaleString()}件から検索できます）`
    } else if (!total) {
      status.textContent = '該当する地震はありません'
    } else if (total > rows.length) {
      status.textContent = `${total.toLocaleString()}件中${rows.length}件を表示`
    } else {
      status.textContent = `${total.toLocaleString()}件`
    }
  }

  /** 選択中の地震。検索語を変えて一覧から外れても、何を見ているかは残す。 */
  function renderCurrent(): void {
    const { eventId } = store.get()
    const e = eventId && index ? index.byId.get(eventId) : undefined
    current.hidden = !e
    if (!e) return
    current.innerHTML =
      `<span class="ev-head">${badge(e)}<span class="ev-name">${esc(e.name)}</span></span>` +
      `<span class="ev-date">${esc(e.label)}</span>` +
      `<span class="ev-meta">${esc(summary(e))}</span>`
  }

  input.addEventListener('input', renderList)

  // 行は毎回作り直すので、個々に購読させず一覧側で受ける。
  list.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('.ev-row')
    if (btn?.dataset.id) store.set({ eventId: btn.dataset.id })
  })

  input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowDown') return
    ev.preventDefault()
    list.querySelector<HTMLButtonElement>('.ev-row')?.focus()
  })

  list.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return
    const rows = [...list.querySelectorAll<HTMLButtonElement>('.ev-row')]
    const i = rows.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    ev.preventDefault()
    if (ev.key === 'ArrowUp' && i === 0) input.focus()
    else rows[ev.key === 'ArrowDown' ? Math.min(i + 1, rows.length - 1) : i - 1].focus()
  })

  store.subscribe((s, prev) => {
    if (s.eventId === prev.eventId) return
    // 選択の印だけを付け替える。一覧そのものは検索語が変わらない限り同じ。
    for (const btn of list.querySelectorAll<HTMLButtonElement>('.ev-row')) {
      if (btn.dataset.id === s.eventId) btn.setAttribute('aria-current', 'true')
      else btn.removeAttribute('aria-current')
    }
    renderCurrent()
  })
}
