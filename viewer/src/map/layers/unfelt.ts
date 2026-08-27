import type { LayerSpecification } from 'maplibre-gl'

import { mltTileUrl } from '../../lib/pmtiles'
import { coordFooter, esc, prop, row } from '../../lib/format'
import type { LayerModule, PaintContext } from './types'

const KEY = 'unfelt'
const POINT_ID = `${KEY}-points`

const COLOR = 'rgb(130, 150, 180)'

/**
 * 無感地震（震度が観測されなかった地震）。
 *
 * 有感地震が震度データ（i*.dat）由来なのに対し、こちらは震源データ（h*.dat）由来。
 * 1919〜2023年で4,938,455件あり、有感の214,763件の23倍ある。
 * タイルは17,833枚・134MB（最大275KB）。低ズームは tippecanoe が間引いている。
 * 沈み込み帯の形をつくるのはこちらで、深さの立体表示ではこのレイヤーが主役になる。
 *
 * 地震IDで絞らない。特定の地震を見るためのものではなく、分布そのものを見るため。
 */
export const unfeltLayer: LayerModule = {
  def: {
    key: KEY,
    name: '無感地震',
    format: 'mlt',
    url: mltTileUrl('jma-hypocenter-unfelt'),
    minzoom: 0,
    maxzoom: 10,
    sourceLayer: 'unfelt',
    defaultVisible: false,
    defaultOpacity: 0.5,
    desc: '震度が観測されなかった地震の震源（1919〜2023年、4,938,455件）。気象庁の震源データ（h*.dat）による。有感地震の23倍あり、沈み込み帯の形をつくるのはこちら。件数が多いため低ズームでは間引いて表示している（最大ズーム10で全点）。震央地名は原データが英語表記。',
    attribution:
      '<a href="https://www.data.jma.go.jp/eqev/data/bulletin/hypo.html" target="_blank" rel="noopener">気象庁 震源データ</a>',
  },

  layerIds: [POINT_ID],
  pickLayerId: POINT_ID,

  specs(ctx: PaintContext): LayerSpecification[] {
    return [
      {
        id: POINT_ID,
        type: 'circle',
        source: KEY,
        'source-layer': this.def.sourceLayer,
        paint: {
          'circle-color': COLOR,
          // 数が多いので小さく。ズームに応じて少しだけ大きくする。
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 3],
          'circle-opacity': ctx.opacity,
        },
      } as LayerSpecification,
    ]
  },

  paintUpdates(ctx: PaintContext) {
    return [{ id: POINT_ID, prop: 'circle-opacity', value: ctx.opacity }]
  },

  filters() {
    // 地震IDで絞らない。分布を見るためのレイヤー。
    return [{ id: POINT_ID, filter: null }]
  },

  legend() {
    return { kind: 'items', items: [{ color: COLOR, label: '無感地震', shape: 'circle' as const }] }
  },

  popupHtml(p, lng, lat) {
    const rows =
      row('発生時刻', prop(p, 'DateTime'), true) +
      row('深さ(km)', prop(p, '深さ')) +
      row('マグニチュード', prop(p, 'マグニチュード')) +
      row('地震ID', prop(p, '地震ID'))
    return (
      `<div class="pp-title">${esc(prop(p, '震央地名') || this.def.name)}</div>` +
      `<div class="pp-sub">${esc(this.def.name)}</div>` +
      (rows ? `<dl class="pp-dl">${rows}</dl>` : '') +
      coordFooter(lng, lat)
    )
  },
}
