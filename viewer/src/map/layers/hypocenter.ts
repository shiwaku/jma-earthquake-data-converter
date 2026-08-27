import type { FilterSpecification, LayerSpecification } from 'maplibre-gl'
import { GLYPH_FONT } from '../basemap'
import { pmtilesUrl } from '../../lib/pmtiles'
import { coordFooter, esc, prop, row } from '../../lib/format'
import type { LayerModule, PaintContext, RenderContext } from './types'

const KEY = 'hypocenter'
const CROSS_ID = `${KEY}-cross`

const CROSS_COLOR = 'rgb(255, 0, 0)'
const HALO_COLOR = 'rgb(255, 255, 0)'

function filterFor(eventId: string | null): FilterSpecification {
  return ['==', ['get', '地震ID'], eventId ?? ''] as FilterSpecification
}

export const hypocenterLayer: LayerModule = {
  def: {
    key: KEY,
    name: '震源',
    url: pmtilesUrl('jma-earthquake/hypocenter_convert.pmtiles'),
    sourceLayer: 'hypocenter_convert',
    defaultVisible: true,
    defaultOpacity: 1,
    desc: '気象庁が決定した震源の位置。震源レコードが複数ある地震では代表値（採用値）のみを収録している。震源が決定できていない地震は座標を持たない。',
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
    const magnitude = prop(p, 'マグニチュード1')
    const rows =
      row('発生時刻', prop(p, 'DateTime'), true) +
      row('マグニチュード', magnitude) +
      row('深さ(km)', prop(p, '深さ(km)')) +
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
