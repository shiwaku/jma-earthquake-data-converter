/**
 * PMTilesの配置ルート。
 *
 * 各レイヤーはここからの相対パスだけを持つ。配信元を変えるときに触るのは
 * `.env` の1行だけで、震源・震度・人口集中地区の3つとも同時に切り替わる。
 *
 * 2026-08-27にCloudflare R2（バケット `shi-works`）へ移行した。旧配信元の
 * Xserver（`https://xs489works.xsrv.jp/pmtiles-data`）は2026-09-30が利用期限。
 * パスは `pmtiles-data/` を `pmtiles/` に正規化しただけで、それ以下は同じ。
 */
const DEFAULT_BASE = 'https://shi-works.com/pmtiles'

export const PMTILES_BASE = (import.meta.env.VITE_PMTILES_BASE || DEFAULT_BASE).replace(/\/+$/, '')

export function pmtilesUrl(path: string): string {
  return `${PMTILES_BASE}/${path}`
}

/**
 * MLTタイルのURLテンプレート。PMTilesと同じルートの隣（.../mlt）に置いてある。
 * 例: https://shi-works.com/mlt/jma-earthquake/{z}/{x}/{y}.mlt
 */
export function mltTileUrl(dataset: string): string {
  return `${PMTILES_BASE.replace(/\/pmtiles$/, '/mlt')}/${dataset}/{z}/{x}/{y}.mlt`
}
