import type { FilterSpecification, LayerSpecification } from 'maplibre-gl'
import { GLYPH_FONT } from '../basemap'
import { pmtilesUrl } from '../../lib/pmtiles'
import { coordFooter, esc, prop, row } from '../../lib/format'
import { SHINDO_CLASSES, shindoColorExpression } from './shindoScale'
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
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 4, 8, 9, 12, 14],
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
        minzoom: 7,
        layout: {
          'text-field': ['get', '震度'],
          'text-font': GLYPH_FONT,
          'text-size': 11,
          'text-offset': [0, -1.2],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': ctx.theme === 'dark' ? '#ffffff' : '#222222',
          'text-halo-color': ctx.theme === 'dark' ? '#000000' : '#ffffff',
          'text-halo-width': 1.2,
          'text-opacity': ctx.opacity,
        },
      } as LayerSpecification,
    ]
  },

  paintUpdates(ctx: PaintContext) {
    return [
      { id: POINT_ID, prop: 'circle-opacity', value: ctx.opacity },
      { id: POINT_ID, prop: 'circle-stroke-opacity', value: ctx.opacity },
      { id: LABEL_ID, prop: 'text-opacity', value: ctx.opacity },
      { id: LABEL_ID, prop: 'text-color', value: ctx.theme === 'dark' ? '#ffffff' : '#222222' },
      { id: LABEL_ID, prop: 'text-halo-color', value: ctx.theme === 'dark' ? '#000000' : '#ffffff' },
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
    const rows =
      row('震度', prop(p, '震度'), true) +
      row('計測震度', prop(p, '震度（計測値）')) +
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
