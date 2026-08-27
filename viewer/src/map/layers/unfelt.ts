import type { LayerSpecification } from 'maplibre-gl'

import { mltTileUrl } from '../../lib/pmtiles'
import { coordFooter, esc, prop, row } from '../../lib/format'
import { depthLegendCss, depthLegendTicks } from './depthScale'
import type { LayerModule } from './types'

const KEY = 'unfelt'

/**
 * 2Dの描画は行わない。無感震源は deck.gl の点群（map/hypocenter3d.ts）で
 * 深さ方向に配置して発光させており、地表面にも同じ点を描くと二重になる。
 *
 * ただしレイヤーを完全に無くすとMapLibreがタイルを読み込まなくなり、
 * querySourceFeatures で点を拾えず3D側が空になる。そのため不透明度0の円を
 * 1枚だけ置いて、ソースとタイル読み込みだけを生かしている。
 */
const LOADER_ID = `${KEY}-loader`

/**
 * 無感地震（震度が観測されなかった地震）。
 *
 * 有感地震が震度データ（i*.dat）由来なのに対し、こちらは震源データ（h*.dat）由来。
 * 沈み込み帯の形をつくるのはこちらで、深さの立体表示ではこのレイヤーが主役になる。
 *
 * 地震IDで絞らない。特定の地震を見るためのものではなく、分布そのものを見るため。
 */
export const unfeltLayer: LayerModule = {
  def: {
    key: KEY,
    name: '震源（無感含む）',
    format: 'mlt',
    url: mltTileUrl('jma-hypocenter-unfelt'),
    minzoom: 0,
    maxzoom: 10,
    sourceLayer: 'unfelt',
    defaultVisible: true,
    defaultOpacity: 1,
    desc:
      '震度が観測されなかった地震の震源です。気象庁が地震月報(カタログ編)として公開している震源データ（h*.dat）に含まれる1919年〜2023年の4,938,455件を収録しています。'
      + '\n\n'
      + '震度が観測された有感地震（214,763件）の約23倍にあたり、日本列島の地震活動の大半を占めます。海溝から大陸側へ向かって深くなる震源の並び、すなわち沈み込むプレートの形が見えるのはこのレイヤーです。'
      + '\n\n'
      + '色は震源の深さを表します。浅いほど暖色、深いほど寒色という地震学の慣例に従っています。刻みは等間隔ではありません。実データの深さは中央値14km、95%が84kmより浅く、最大698kmという強い偏りがあるため、0〜700kmを均等に塗ると大半が同じ色に潰れてしまいます。浅部に刻みを寄せることで、地殻内の浅い地震と沈み込むプレート内の深い地震を区別できるようにしています。'
      + '\n\n'
      + '特定の地震を選んでも絞り込まれません。個々の地震ではなく分布そのものを見るためのレイヤーです。件数が非常に多いため、表示が重い場合は不透明度を下げるか、レイヤーをオフにしてください。'
      + '\n\n'
      + '注意点として、震央地名は原データが英語表記です（例: E OFF FUKUSHIMA PREF）。また震源の深さの決定方法は年代によって異なります。',
    attribution:
      '<a href="https://www.data.jma.go.jp/eqev/data/bulletin/hypo.html" target="_blank" rel="noopener">気象庁 震源データ</a>',
  },

  layerIds: [LOADER_ID],
  pickLayerId: LOADER_ID,

  specs(): LayerSpecification[] {
    return [
      {
        id: LOADER_ID,
        type: 'circle',
        source: KEY,
        'source-layer': this.def.sourceLayer,
        paint: { 'circle-radius': 1, 'circle-opacity': 0 },
      } as LayerSpecification,
    ]
  },

  // 見た目は3D側が持つ。2Dには反映するものがない。
  paintUpdates() {
    return []
  },

  filters() {
    // 地震IDで絞らない。分布を見るためのレイヤー。
    return [{ id: LOADER_ID, filter: null }]
  },

  legend() {
    return { kind: 'gradient', css: depthLegendCss(), ticks: depthLegendTicks() }
  },

  popupHtml(p, lng, lat) {
    // 列名は hypo_dat_converter.py の FIELDS に合わせる。
    const rows =
      row('発生時刻', prop(p, 'DateTime'), true) +
      row('深さ(km)', prop(p, '深さ(km)')) +
      row('マグニチュード', prop(p, 'マグニチュード1')) +
      row('震源決定フラグ', prop(p, '震源決定フラグ')) +
      row('地震ID', prop(p, '地震ID'))
    return (
      `<div class="pp-title">${esc(prop(p, '震央地名') || this.def.name)}</div>` +
      `<div class="pp-sub">${esc(this.def.name)}</div>` +
      (rows ? `<dl class="pp-dl">${rows}</dl>` : '') +
      coordFooter(lng, lat)
    )
  },
}
