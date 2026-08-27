import type { ExpressionSpecification, FilterSpecification, LayerSpecification } from 'maplibre-gl'
import { GLYPH_FONT } from '../basemap'
import { mltTileUrl } from '../../lib/pmtiles'
import { coordFooter, esc, prop, row } from '../../lib/format'
import type { LayerModule, PaintContext, RenderContext } from './types'

const KEY = 'hypocenter'
const CROSS_ID = `${KEY}-cross`

const CROSS_COLOR = 'rgb(255, 0, 0)'
const HALO_COLOR = 'rgb(255, 255, 0)'

/**
 * 深さ(km) → 高さ(m)。震源は地下にあるので負。
 * 真上から見る分には高さを変えても画面上の位置は変わらないため、常に置いてよい。
 */
const DEPTH_OFFSET = ['*', ['to-number', ['get', '深さ'], 0], -1000] as ExpressionSpecification

function filterFor(eventId: string | null): FilterSpecification {
  return ['==', ['get', '地震ID'], eventId ?? ''] as FilterSpecification
}

export const hypocenterLayer: LayerModule = {
  def: {
    key: KEY,
    name: '震源（有感のみ）',
    // 震源はMLTで配信する。3Dの点群も同じソースを使うので取得は1系統で済む。
    format: 'mlt',
    url: mltTileUrl('jma-earthquake'),
    minzoom: 0,
    maxzoom: 8,
    sourceLayer: 'hypocenter',
    defaultVisible: false,
    defaultOpacity: 1,
    desc:
      '気象庁が決定した地震の震源です。地震月報(カタログ編)の震度データに含まれる1919年〜2022年の214,763件を収録しています。選択した地震の震源を×印で表示します。'
      + '\n\n'
      + 'ここでいう有感地震とは、いずれかの観測点で震度が観測された地震のことです。震度が観測されなかった地震は「震源（無感含む）」レイヤーに収録しています。'
      + '\n\n'
      + '1つの地震に複数の震源レコードがある場合、1番上のレコード（代表値・採用値）のみを採用しています。震源が決定できなかった地震は座標を持たないため表示されません（124件）。'
      + '\n\n'
      + '深さの決定方法は年代によって異なります。深さを固定して計算した時期があり、1926〜1960年と1967〜1982年は10km刻み、1961〜1966年は20km刻み、1983年以降は1km刻みです。ただし1982年以前の地震は適宜再調査され、深さを固定しない計算または1km刻みの震源に置き換えられています。',
    attribution:
      '<a href="https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html" target="_blank" rel="noopener">気象庁 震源データ</a>',
  },

  layerIds: [CROSS_ID],
  pickLayerId: CROSS_ID,

  specs(ctx: PaintContext): LayerSpecification[] {
    return [
      {
        id: CROSS_ID,
        type: 'symbol',
        source: KEY,
        'source-layer': this.def.sourceLayer,
        filter: filterFor(ctx.eventId),
        layout: {
          'text-field': '×',
          'text-font': GLYPH_FONT,
          // 深さ(km)ぶん地下へ下げる。maplibre 6.6.0 の symbol-height-offset は
          // メートル単位のdata-drivenで、負値で地表より下に置ける。
          'symbol-height-offset': DEPTH_OFFSET,
          'text-size': ['interpolate', ['linear'], ['zoom'], 4, 28, 10, 50],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': CROSS_COLOR,
          'text-halo-color': HALO_COLOR,
          'text-halo-width': 2,
          'text-opacity': ctx.opacity,
        },
      } as LayerSpecification,
    ]
  },

  paintUpdates(ctx: PaintContext) {
    return [{ id: CROSS_ID, prop: 'text-opacity', value: ctx.opacity }]
  },


  filters(ctx: RenderContext) {
    return [{ id: CROSS_ID, filter: filterFor(ctx.eventId) }]
  },

  legend() {
    // 地図には×印を出しているので、見本も×にする。丸だと別の記号に見える。
    return {
      kind: 'items',
      items: [{ color: CROSS_COLOR, label: '震源', shape: 'cross', haloColor: HALO_COLOR }],
    }
  },

  popupHtml(p, lng, lat) {
    // MLT側の属性名は変換時に短くしてある
    const magnitude = prop(p, 'マグニチュード') || prop(p, 'マグニチュード1')
    const rows =
      row('発生時刻', prop(p, 'DateTime'), true) +
      row('マグニチュード', magnitude) +
      row('深さ(km)', prop(p, '深さ') || prop(p, '深さ(km)')) +
      row('最大震度', prop(p, '最大震度')) +
      row('観測点数', prop(p, '観測点数')) +
      row('地震ID', prop(p, '地震ID'))
    return (
      `<div class="pp-title">${esc(prop(p, '震央地名') || this.def.name)}</div>` +
      `<div class="pp-sub">${esc(this.def.name)}</div>` +
      (rows ? `<dl class="pp-dl">${rows}</dl>` : '') +
      coordFooter(lng, lat)
    )
  },
}
