/**
 * 地震の索引。`public/events.json`（src/build_event_index.py が生成）を読む。
 *
 * 旧ビューワは表示できる地震が14件のハードコードだった。ここでは最大震度3以上の
 * 15,480件を読み込み、震央地名・年月日・マグニチュード・震度で引けるようにする。
 * 震源データ全件（214,763件）を索引にすると十数MBになるため、足切りは生成側で行う。
 */

/** 震度階級の順序。改定前の '5'/'6' は弱・強の下限として扱う。 */
const SHINDO_ORDER: Record<string, number> = {
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '5弱': 5, '5-': 5, '5強': 6, '5+': 6,
  '6': 7, '6弱': 7, '6-': 7, '6強': 8, '6+': 8,
  '7': 9,
}

/**
 * 検索欄が空のときに出す主な地震。旧ビューワがプルダウンに固定で並べていた14件。
 * 索引に載っている15,480件を新しい順に並べただけでは取っ掛かりがないため、
 * 入口としてこれを見せる。
 */
export const NOTABLE_IDS: string[] = [
  '20180906030759', '20180618075834', '20160416012505', '20160414212634',
  '20110311144618', '20070716101322', '20041023175600', '20030926045007',
  '19950117054651', '19930712221711', '19830526115957', '19461221041904',
  '19441207133540', '19230901115831',
]

/** 初回表示。旧ビューワの初期選択と同じ1923年関東地震。 */
export const DEFAULT_EVENT_ID = '19230901115831'

export interface EventRecord {
  /** 地震ID。発生時刻 YYYYMMDDhhmmss そのもの。 */
  id: string
  /** 震央地名 */
  name: string
  mag: number | null
  /** 最大震度。'5弱' のような改定後表記と、改定前の '5' が混在する。 */
  shindo: string
  depth: number | null
  stations: number
  /** カメラを寄せる範囲 [w, s, e, n]。 */
  bbox: [number, number, number, number] | null
  /** 表示用の日時（1923年09月01日 11:58）。 */
  label: string
  /** 検索用に正規化した文字列。 */
  hay: string
}

export interface EventIndex {
  /** 索引に含めた最大震度の下限。 */
  minShindo: string
  /** 新しい順。 */
  all: EventRecord[]
  byId: Map<string, EventRecord>
}

interface RawIndex {
  minShindo: string
  count: number
  fields: string[]
  events: [string, string, number | null, string, number | null, number,
    [number, number, number, number] | null][]
}

let index: EventIndex | null = null

/** 全角の数字・記号を半角に落とす。検索欄に「７」「Ｍ」と打たれても引けるように。 */
function toHalfWidth(s: string): string {
  return s.replace(/[Ａ-Ｚａ-ｚ０-９．－＋]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0))
}

function formatLabel(id: string): string {
  const [, y, mo, d, h, mi] = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(id) ?? []
  if (!y) return id
  return `${y}年${mo}月${d}日 ${h}:${mi}`
}

function toRecord(row: RawIndex['events'][number]): EventRecord {
  const [id, name, mag, shindo, depth, stations, bbox] = row
  return {
    id, name, mag, shindo, depth, stations, bbox,
    label: formatLabel(id),
    // 地震IDそのものを含めるので、IDの丸ごと貼り付けでも引ける。
    hay: `${id} ${name}`,
  }
}

export async function loadEventIndex(): Promise<EventIndex> {
  if (index) return index
  const res = await fetch(`${import.meta.env.BASE_URL}events.json`)
  if (!res.ok) throw new Error(`events.json を読めなかった (${res.status})`)
  const raw = (await res.json()) as RawIndex

  const all = raw.events.map(toRecord)
  // 生成側は地震ID（＝発生時刻）の昇順で書き出す。表示は新しい順にする。
  all.reverse()

  index = { minShindo: raw.minShindo, all, byId: new Map(all.map((e) => [e.id, e])) }
  return index
}

/** 読み込み済みの索引から引く。未読込みなら undefined。 */
export function eventById(id: string): EventRecord | undefined {
  return index?.byId.get(id)
}

export function shindoRank(value: string): number | undefined {
  return SHINDO_ORDER[value]
}

type Match = (e: EventRecord) => boolean

/**
 * 検索語ひとつを判定関数にする。語の形で意味を変える。
 *   M7        マグニチュード7.0以上
 *   震度6     最大震度6弱以上（弱・強や改定前の6も含む）
 *   2011      地震IDの前方一致（＝年）
 *   2011-3-11 区切りがあれば0埋めして年月日として前方一致
 *   熊本      震央地名の部分一致
 */
function termMatcher(term: string): Match | null {
  const mag = /^m(\d+(?:\.\d+)?)$/i.exec(term)
  if (mag) {
    const min = Number(mag[1])
    return (e) => e.mag !== null && e.mag >= min
  }

  const shindo = /^(?:震度|しんど)(.+)$/.exec(term)
  if (shindo) {
    const min = SHINDO_ORDER[shindo[1]]
    // 「震度あ」のような引けない指定は、何にも当たらない語として扱う。
    if (min === undefined) return () => false
    return (e) => (SHINDO_ORDER[e.shindo] ?? -1) >= min
  }

  const prefix = datePrefix(term)
  if (prefix) return (e) => e.id.startsWith(prefix)

  return (e) => e.hay.includes(term)
}

/** 年月日らしい語を、地震IDの前方一致に使える数字列に直す。 */
function datePrefix(term: string): string | null {
  if (/^\d+$/.test(term)) return term

  if (!/^[\d年月日/.-]+$/.test(term)) return null
  const parts = term.split(/[年月日/.-]+/).filter(Boolean)
  if (!parts.length || !parts.every((p) => /^\d+$/.test(p))) return null
  // 先頭は年なのでそのまま。以降は2桁に0埋めしないとIDの桁と揃わない。
  return parts[0] + parts.slice(1).map((p) => p.padStart(2, '0')).join('')
}

export interface SearchResult {
  rows: EventRecord[]
  /** 語に当たった総数。rows は limit で切ってある。 */
  total: number
  /** 検索語がなく、主な地震を出しているか。 */
  notable: boolean
}

export function searchEvents(idx: EventIndex, query: string, limit: number): SearchResult {
  const terms = toHalfWidth(query).trim().split(/[\s、,]+/).filter(Boolean)

  if (!terms.length) {
    const rows = NOTABLE_IDS.map((id) => idx.byId.get(id)).filter((e): e is EventRecord => !!e)
    return { rows, total: rows.length, notable: true }
  }

  const matchers = terms.map(termMatcher).filter((m): m is Match => !!m)
  const rows: EventRecord[] = []
  let total = 0
  for (const e of idx.all) {
    if (!matchers.every((m) => m(e))) continue
    total++
    if (rows.length < limit) rows.push(e)
  }
  return { rows, total, notable: false }
}
