/**
 * PMTilesの配置ルート。
 *
 * 各レイヤーはここからの相対パスだけを持つ。配信元を変えるときに触るのは
 * `.env` の1行だけで、震源・震度・人口集中地区の3つとも同時に切り替わる。
 *
 * 既定は現行の Xserver（xs489works）。この配信元は 2026-09-30 が利用期限で、
 * Cloudflare R2（`https://shi-works.com/pmtiles`）への移行が予定されている。
 * 移行後のパスは `pmtiles-data/` を `pmtiles/` に正規化したもので、
 * ルート以下は変わらない。
 */
const DEFAULT_BASE = 'https://xs489works.xsrv.jp/pmtiles-data'

export const PMTILES_BASE = (import.meta.env.VITE_PMTILES_BASE || DEFAULT_BASE).replace(/\/+$/, '')

export function pmtilesUrl(path: string): string {
  return `${PMTILES_BASE}/${path}`
}
