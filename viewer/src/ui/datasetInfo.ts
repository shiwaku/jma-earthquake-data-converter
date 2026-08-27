import { loadEventIndex } from '../lib/events'
import { esc } from '../lib/format'
import { LAYERS } from '../map/layers/registry'

/**
 * 収録データの要約。
 *
 * 表示しているレイヤーに合わせて中身を変える。地震の検索索引（events.json）は
 * 有感地震しか持たないため、震源（有感のみ）か各観測点の震度が有効なときだけ
 * その要約を出す。無感震源だけを出しているときに「選べる地震 15,480件」と
 * 書くと、画面に出ていないデータの説明になってしまう。
 */

/** 無感震源の収録件数。src/hypo_dat_converter.py の出力を数えた値。 */
const UNFELT_ROWS = '4,938,455件（1919〜2023年）'

const hasKey = (key: string): boolean => LAYERS.some((m) => m.def.key === key)

export function createDatasetInfo(): void {
  const root = document.getElementById('dataset-info') as HTMLElement

  const rows: [string, string][] = []
  if (hasKey('unfelt')) rows.push(['震源（無感含む）', UNFELT_ROWS])

  if (!hasKey('hypocenter') && !hasKey('shindo')) {
    render(rows)
    return
  }

  loadEventIndex()
    .then((idx) => {
      // 索引は新しい順。地震IDの先頭4桁が発生年。
      const newest = idx.all[0]?.id.slice(0, 4) ?? ''
      const oldest = idx.all[idx.all.length - 1]?.id.slice(0, 4) ?? ''
      render([
        ...rows,
        ['収録期間', `${oldest}〜${newest}年`],
        ['選べる地震', `${idx.all.length.toLocaleString()}件`],
        ['収録の下限', `最大震度${idx.minShindo}`],
      ])
    })
    .catch(() => render([...rows, ['収録期間', '取得できません']]))

  function render(items: [string, string][]): void {
    root.innerHTML = items
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join('')
  }
}
