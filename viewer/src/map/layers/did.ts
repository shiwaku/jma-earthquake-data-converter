import type { LayerSpecification } from 'maplibre-gl'
import { coordFooter, esc, prop, row } from '../../lib/format'
import { pmtilesUrl } from '../../lib/pmtiles'
import type { LayerModule, PaintContext } from './types'

const KEY = 'did'
const LAYER_ID = `${KEY}-lyr`
const FILL = 'rgb(255, 191, 0)'

// e-Stat 境界データの属性名 → 和名。
const LABELS: Record<string, string> = {
  KEN: '都道府県コード',
  CITY: '市区町村コード',
  CITYNAME: '市区町村名',
  CLASS: '区分',
  JINKO: '人口',
  MENSEKI: '面積(km²)',
}

export const didLayer: LayerModule = {
  def: {
    key: KEY,
    name: '人口集中地区（2020年）',
    url: pmtilesUrl('r2DID/2020_did_ddsw_01-47_JGD2011.pmtiles'),
    sourceLayer: '2020_did_ddsw_0147_JGD2011fgb',
    defaultVisible: false,
    defaultOpacity: 0.3,
    desc:
      '国勢調査の基本単位区等を基礎とし、人口密度が1平方キロメートルあたり4,000人以上の基本単位区等が市区町村の区域内で互いに隣接して人口が5,000人以上となる地区です。市街地の広がりを示す指標として用いられます。'
      + '\n\n'
      + 'ここでは震度の分布と市街地の重なりを見るために重ねています。同じ震度でも、人口が集中している場所で観測されたかどうかで被害の意味合いが変わるためです。'
      + '\n\n'
      + '2020年国勢調査の結果によるもので、地震の発生年とは対応していません。過去の地震に重ねた場合、当時の市街地の広がりとは異なる点にご注意ください。',
    attribution:
      '<a href="https://www.e-stat.go.jp/gis" target="_blank" rel="noopener">政府統計の総合窓口[e-Stat] 人口集中地区（2020年）</a>',
  },

  layerIds: [LAYER_ID],
  pickLayerId: LAYER_ID,

  specs(ctx: PaintContext): LayerSpecification[] {
    return [
      {
        id: LAYER_ID,
        type: 'fill',
        source: KEY,
        'source-layer': this.def.sourceLayer,
        paint: { 'fill-color': FILL, 'fill-opacity': ctx.opacity },
      } as LayerSpecification,
    ]
  },

  paintUpdates(ctx: PaintContext) {
    return [{ id: LAYER_ID, prop: 'fill-opacity', value: ctx.opacity }]
  },

  // 地震の切替とは無関係な静的レイヤー。
  filters() {
    return []
  },

  legend() {
    return {
      kind: 'items',
      items: [{ color: 'rgba(255, 191, 0, 0.6)', label: this.def.name, shape: 'square' }],
    }
  },

  popupHtml(p, lng, lat) {
    const rows = Object.entries(LABELS)
      .map(([k, label]) => row(label, prop(p, k)))
      .join('')
    return (
      `<div class="pp-title">${esc(prop(p, 'CITYNAME') || this.def.name)}</div>` +
      `<div class="pp-sub">${esc(this.def.name)}</div>` +
      (rows ? `<dl class="pp-dl">${rows}</dl>` : '') +
      coordFooter(lng, lat)
    )
  },
}
