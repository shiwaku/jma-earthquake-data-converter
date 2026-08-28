import { MapboxOverlay } from '@deck.gl/mapbox'
import { ScatterplotLayer } from '@deck.gl/layers'
import type { Map as MapLibreMap } from 'maplibre-gl'

import { depthColor } from './layers/depthScale'
import type { AppStore, Selection } from '../state'

/**
 * 震源を深さで立体表示する。
 *
 * データは MLT（MapLibre Tile）で配る。仕様は3D座標に対応しているが、JS側は
 * 入口から出口まで2Dのため深さはジオメトリに持たせられない。
 *   - エンコーダ: mltEncoder の Position が [number, number]
 *   - デコーダ:   VertexBufferType.VEC_3 は enum に値があるだけで参照0件
 *   - MapLibre:   MLTVectorTileFeature.loadGeometry() が new Point(x, y) で z を捨てる
 * そのため深さは属性で運び、[lng, lat, -深さ×1000] の組み立ては deck.gl 側で行う。
 * これは参考実装（gsi-2026-mlt-demo）が建物の標高で採っている構成と同じ。
 *
 * データは震源レイヤー（layers/hypocenter.ts）のMLTソースをそのまま使う。取得は1系統で、
 * 2Dの×印と3Dの点群が同じタイルを共有する。
 * 震源レイヤーを非表示にするとソースごと外れるため、3Dの点群も消える。
 */

/**
 * 立体表示に使うソース。有感（震度データ由来）と無感（震源データ由来）の両方を読む。
 * 沈み込み帯の形をつくるのは無感のほうで、有感だけでは点が疎で帯にならない。
 * どちらもレイヤーを非表示にするとソースごと外れ、点群からも消える。
 */
const SOURCES: [string, string][] = [
  ['hypocenter', 'hypocenter'],
  ['unfelt', 'unfelt'],
]

interface Point3D {
  /** 地物の同一性（featureKey）。属性を引き直すときの手がかりに持つ。 */
  id: string
  position: [number, number, number]
  color: [number, number, number]
  /** 由来のレイヤーキー。表示中のレイヤーだけを描くために持つ。 */
  source: string
}

/**
 * 点の同一性。
 * 地震IDは一意ではない（同じ秒に決定された別レコードが衝突する）ため座標も混ぜる。
 * タイル境界をまたぐ重複を潰すのが目的なので、丸めて十分。
 */
function featureKey(p: Record<string, unknown>, lng: number, lat: number): string {
  return `${p['地震ID'] ?? ''}|${lng.toFixed(4)},${lat.toFixed(4)}`
}

/**
 * クリック・ホバーの当たり半径(px)。点は最大4pxしかなく、そのままでは狙えない。
 */
const PICK_RADIUS = 5

/**
 * 点群に載せる点の上限。
 *
 * キャッシュは消さない設計（タイルの出入りで点が明滅するのを防ぐため）だが、
 * 消さないままだと触っているほど増え続ける。実測では、z3で開いてz10まで寄って
 * z3へ戻すと 36,073点 → 54,665点 のまま減らない。同じズームでも、それまでに
 * どこを拡大したかで密度が変わってしまう。
 *
 * 上限を超えたら**拾った順に古いものから捨てる**。Mapは挿入順を保つのでそのまま使える。
 */
const MAX_POINTS = 300_000

/** 立体表示の点を画面座標で拾う口。クリック処理（map/interactions.ts）が使う。 */
export interface Hypocenter3dPicker {
  /** その位置に点があるか。カーソル形状の判定に使う軽いほう。 */
  hitTest(x: number, y: number): boolean
  /** その位置の点を属性ごと拾う。当たらなければ null。 */
  pick(x: number, y: number): Selection | null
}

export function createHypocenter3d(map: MapLibreMap, store: AppStore): Hypocenter3dPicker {
  let overlay: MapboxOverlay | null = null
  // querySourceFeatures はタイルのロード・アンロードで返る集合が変動する。
  // 取得したものを加算キャッシュして削除しないことで、点の明滅を防ぐ。
  const cache = new Map<string, Point3D>()
  let pending = false

  function collect(): void {
    pending = false
    if (!store.get().depth3d) return
    let added = false
    const features = SOURCES.flatMap(([source, sourceLayer]) =>
      map.getSource(source)
        ? map.querySourceFeatures(source, { sourceLayer }).map((f) => ({ f, source }))
        : [],
    )
    for (const { f, source } of features) {
      const p = f.properties ?? {}
      const g = f.geometry
      if (g?.type !== 'Point') continue
      const [lng, lat] = g.coordinates as [number, number]
      const id = featureKey(p, lng, lat)
      if (cache.has(id)) continue
      // 深さはkm。地下は負の高さになる。
      const km = Number(p['深さ'] ?? p['深さ(km)'] ?? 0)
      const z = -(Number.isFinite(km) ? km : 0) * 1000
      cache.set(id, { id, position: [lng, lat, z], color: depthColor(km), source })
      added = true
    }
    if (!added) return
    // 増えすぎたら古いものから捨てる
    if (cache.size > MAX_POINTS) {
      let over = cache.size - MAX_POINTS
      for (const key of cache.keys()) {
        cache.delete(key)
        if (--over <= 0) break
      }
    }
    render()
  }

  function schedule(): void {
    if (pending) return
    pending = true
    requestAnimationFrame(collect)
  }

  let renderPending = false

  function scheduleRender(): void {
    if (renderPending) return
    renderPending = true
    requestAnimationFrame(() => {
      renderPending = false
      render()
    })
  }

/**
 * 点の濃さと大きさはズームで変える。
 *
 * タイルは低ズームほど強く間引かれる（tippecanoe の --drop-densest-as-needed）。
 * 引いた絵では点が少ないので、濃さを上げないと震源の並びが読めない。
 * 逆に寄ると点が一気に増え、濃いままだと重なって一枚の塊になり深さが読めなくなる。
 *
 * レイヤーパネルのスライダー値には、ここで求めた濃さを掛ける。
 */
const RAMP = { minZoom: 4, maxZoom: 7, opacityNear: 0.25, opacityFar: 0.9, sizeNear: 1, sizeFar: 3 }

/** ズームから濃さと点の最小径(px)を求める。低ズーム側で濃く・大きく。 */
function rampFor(zoom: number): { opacity: number; minPixels: number } {
  const t = Math.min(1, Math.max(0, (zoom - RAMP.minZoom) / (RAMP.maxZoom - RAMP.minZoom)))
  return {
    opacity: RAMP.opacityFar + (RAMP.opacityNear - RAMP.opacityFar) * t,
    minPixels: RAMP.sizeFar + (RAMP.sizeNear - RAMP.sizeFar) * t,
  }
}

  function render(): void {
    if (!overlay) return
    const ramp = rampFor(map.getZoom())
    // キャッシュは明滅を防ぐため消さない。代わりにここで表示中のレイヤーだけへ絞る。
    // 不透明度はレイヤーごとに違うので、ソース単位でレイヤーを分ける。
    const layers = store.get().layers
    const bySource = new Map<string, Point3D[]>()
    for (const d of cache.values()) {
      if (!layers[d.source]?.visible) continue
      const list = bySource.get(d.source)
      if (list) list.push(d)
      else bySource.set(d.source, [d])
    }

    overlay.setProps({
      layers: [...bySource].map(
        ([source, data]) =>
          new ScatterplotLayer<Point3D>({
            id: `hypocenter-3d-${source}`,
            data,
            // 大きさは一定にして、重ね合わせの濃淡で密度を見せる。
            // マグニチュードで変えると重なって潰れる。
            getPosition: (d) => d.position,
            getFillColor: (d) => d.color,
            getRadius: 500,
            radiusMinPixels: ramp.minPixels,
            radiusMaxPixels: 4,
            opacity: (layers[source]?.opacity ?? 1) * ramp.opacity,
            billboard: true,
            antialiasing: false,
            // ポップアップのために拾えるようにする。点が小さいので当たり判定は
            // pickObject 側の radius で広げる。
            pickable: true,
          }),
      ),
    })
  }

  function enable(): void {
    if (!overlay) {
      overlay = new MapboxOverlay({ interleaved: true, layers: [] })
      map.addControl(overlay)
      map.on('sourcedata', onSourceData)
      map.on('moveend', schedule)
      // ズームで濃さが変わる。動かしている最中も追従させる（1フレームに1回）
      map.on('zoom', scheduleRender)
    }
    schedule()
  }

  function disable(): void {
    cache.clear()
    overlay?.setProps({ layers: [] })
  }

  function onSourceData(e: { sourceId?: string; sourceDataType?: string }): void {
    if (e.sourceDataType === 'metadata') return
    if (!SOURCES.some(([id]) => id === e.sourceId)) return
    schedule()
  }

  /**
   * 拾った点に対応する地物の属性。
   * 点群は表示に要る値しか持たない（全点ぶんの属性を抱えるとメモリを食う）ため、
   * 拾えたときだけソースから引き直す。
   */
  function propertiesOf(d: Point3D): Record<string, unknown> | null {
    const entry = SOURCES.find(([source]) => source === d.source)
    if (!entry || !map.getSource(d.source)) return null
    const eqId = d.id.slice(0, d.id.indexOf('|'))
    // 読み込み済みタイルの全件を舐めさせないよう地震IDで絞る。
    // タイル側で数値になっている場合に備えて文字列化してから比べる。
    const feats = map.querySourceFeatures(d.source, {
      sourceLayer: entry[1],
      filter: ['==', ['to-string', ['get', '地震ID']], eqId],
    })
    for (const f of feats) {
      const g = f.geometry
      if (g?.type !== 'Point') continue
      const [lng, lat] = g.coordinates as [number, number]
      const p = (f.properties ?? {}) as Record<string, unknown>
      // 地震IDだけでは絞り切れない。キャッシュのキーと同じ作り方で突き合わせる。
      if (featureKey(p, lng, lat) === d.id) return p
    }
    return null
  }

  function pickPoint(x: number, y: number): Point3D | null {
    if (!overlay || !store.get().depth3d) return null
    const info = overlay.pickObject({ x, y, radius: PICK_RADIUS })
    return (info?.object as Point3D | undefined) ?? null
  }

  store.subscribe((s, prev) => {
    if (s.depth3d !== prev.depth3d) {
      if (s.depth3d) enable()
      else disable()
      return
    }
    // 背景やテーマの切替でスタイルごと作り直される。震源レイヤーのON/OFFでも
    // ソースが出入りするため、いずれも取り直す。
    if (s.layers !== prev.layers) {
      // 表示の切替は即座に反映する。新たにONになった分は idle 後に集め直す。
      render()
      map.once('idle', schedule)
      return
    }
    if (s.depth3d && (s.theme !== prev.theme || s.basemap !== prev.basemap)) {
      map.once('idle', schedule)
    }
  })

  if (store.get().depth3d) enable()

  return {
    hitTest: (x, y) => pickPoint(x, y) !== null,

    pick(x, y) {
      const d = pickPoint(x, y)
      if (!d) return null
      const properties = propertiesOf(d)
      // タイルが入れ替わって元の地物が引けないことがある。
      // 属性のないポップアップを出しても仕方がないので、その場合は拾えなかった扱い。
      if (!properties) return null
      const [lng, lat, z] = d.position
      return { layerKey: d.source, properties, lng, lat, altitude: z }
    },
  }
}
