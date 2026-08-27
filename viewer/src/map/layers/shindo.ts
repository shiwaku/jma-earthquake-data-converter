import type { FilterSpecification, LayerSpecification } from 'maplibre-gl'
import { GLYPH_FONT } from '../basemap'
import { pmtilesUrl } from '../../lib/pmtiles'
import { coordFooter, esc, prop, row } from '../../lib/format'
import { SHINDO_CLASSES, shindoColorExpression, shindoInkExpression } from './shindoScale'
import type { LayerModule, PaintContext, RenderContext } from './types'

const KEY = 'shindo'
const POINT_ID = `${KEY}-points`
const LABEL_ID = `${KEY}-labels`

/** 地震IDで絞り込む。未選択のときは何も出さない。 */
function filterFor(eventId: string | null): FilterSpecification {
  return ['==', ['get', '地震ID'], eventId ?? ''] as FilterSpecification
}

export const shindoLayer: LayerModule = {
  def: {
    key: KEY,
    name: '震度',
    url: pmtilesUrl('jma-earthquake/shindo_convert.pmtiles'),
    sourceLayer: 'shindo_convert',
    defaultVisible: true,
    defaultOpacity: 1,
    desc: '各震度観測点で観測された震度。1996年10月の震度階級改定より前は震度5・6に強弱の区別がない。観測点の名称と座標は震度観測点一覧から観測点番号で結合している。',
    attribution:
      '<a href="https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html" target="_blank" rel="noopener">気象庁 震度データ</a>',
  },

  layerIds: [POINT_ID, LABEL_ID],
  pickLayerId: POINT_ID,

  specs(ctx: PaintContext): LayerSpecification[] {
    const filter = filterFor(ctx.eventId)
    return [
      {
        id: POINT_ID,
        type: 'circle',
        source: KEY,
        'source-layer': this.def.sourceLayer,
        filter,
        paint: {
          'circle-color': shindoColorExpression(),
          'circle-radius': ['step', ['zoom'], 5, 7.5, 9],
          'circle-stroke-color': 'rgba(0, 0, 0, 0.5)',
          'circle-stroke-width': 1,
          'circle-opacity': ctx.opacity,
          'circle-stroke-opacity': ctx.opacity,
        },
      } as LayerSpecification,
      {
        id: LABEL_ID,
        type: 'symbol',
        source: KEY,
        'source-layer': this.def.sourceLayer,
        filter,
        // 円が9pxに広がるズームから出す。5pxの円に数字を載せても読めない。
        minzoom: 7.5,
        layout: {
          'text-field': ['get', '震度'],
          'text-font': GLYPH_FONT,
          'text-size': 16,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': shindoInkExpression(),
          'text-opacity': ctx.opacity,
        },
      } as LayerSpecification,
    ]
  },

  paintUpdates(ctx: PaintContext) {
    return [
      { id: POINT_ID, prop: 'circle-opacity', value: ctx.opacity },
      { id: POINT_ID, prop: 'circle-stroke-opacity', value: ctx.opacity },
      // 文字色は階級で決まるので、テーマでは変えない
      { id: LABEL_ID, prop: 'text-opacity', value: ctx.opacity },
    ]
  },

  filters(ctx: RenderContext) {
    const filter = filterFor(ctx.eventId)
    return [
      { id: POINT_ID, filter },
      { id: LABEL_ID, filter },
    ]
  },

  legend() {
    return {
      kind: 'items',
      items: SHINDO_CLASSES.map((c) => ({ color: c.color, label: c.label, shape: 'circle' as const })),
    }
  },

  popupHtml(p, lng, lat) {
    // 計測震度の '//' は「値なし」を表す気象庁の記号。そのまま出しても読めない。
    const measured = prop(p, '震度（計測値）')
    const rows =
      row('震度', prop(p, '震度'), true) +
      row('計測震度', measured === '//' ? '' : measured) +
      row('発現時刻', prop(p, 'DateTime')) +
      row('観測点番号', prop(p, '観測点番号')) +
      row('地震ID', prop(p, '地震ID'))
    return (
      `<div class="pp-title">${esc(prop(p, '震度発表名称') || this.def.name)}</div>` +
      `<div class="pp-sub">${esc(this.def.name)}</div>` +
      (rows ? `<dl class="pp-dl">${rows}</dl>` : '') +
      coordFooter(lng, lat)
    )
  },
}
