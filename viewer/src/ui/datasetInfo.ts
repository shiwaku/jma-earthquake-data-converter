import { loadEventIndex } from '../lib/events'
import { esc } from '../lib/format'

/**
 * 収録データの要約。件数や期間は索引から数えるので、
 * データを更新して events.json を作り直せばそのまま追随する。
 */
export function createDatasetInfo(): void {
  const root = document.getElementById('dataset-info') as HTMLElement

  loadEventIndex()
    .then((idx) => {
      // 索引は新しい順。地震IDの先頭4桁が発生年。
      const newest = idx.all[0]?.id.slice(0, 4) ?? ''
      const oldest = idx.all[idx.all.length - 1]?.id.slice(0, 4) ?? ''
      render([
        ['収録期間', `${oldest}〜${newest}年`],
        ['選べる地震', `${idx.all.length.toLocaleString()}件`],
        ['収録の下限', `最大震度${idx.minShindo}`],
      ])
    })
    .catch(() => render([['収録期間', '取得できません']]))

  function render(rows: [string, string][]): void {
    root.innerHTML = rows
      .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
      .join('')
  }
}
