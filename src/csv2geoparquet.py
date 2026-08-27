"""変換済みCSVを点ジオメトリのGeoParquet形式へ変換する。

  python src/csv2geoparquet.py hypocenter_convert.csv hypocenter_convert.parquet \
      --lon Longitude --lat Latitude

座標が欠損している行、および緯度経度がともに0の行は出力から除く。
気象庁の震度観測点一覧には座標が 0,0 の面的判定用レコード
（例: 5399999「神戸市等阪神淡路地域」）が含まれるため。
"""
import argparse
import sys

import geopandas as gpd
import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_csv')
    parser.add_argument('output_parquet')
    parser.add_argument('--lon', required=True, help='経度の列名')
    parser.add_argument('--lat', required=True, help='緯度の列名')
    parser.add_argument('--crs', default='EPSG:4326')
    return parser.parse_args()


def main():
    args = parse_args()

    df = pd.read_csv(args.input_csv, low_memory=False)
    total = len(df)
    for column in (args.lon, args.lat):
        if column not in df.columns:
            sys.exit(f'列 {column} が {args.input_csv} にありません')
        df[column] = pd.to_numeric(df[column], errors='coerce')

    missing = df[args.lon].isna() | df[args.lat].isna()
    null_island = (df[args.lon] == 0) & (df[args.lat] == 0)
    df = df[~(missing | null_island)]

    gdf = gpd.GeoDataFrame(
        df,
        geometry=gpd.points_from_xy(df[args.lon], df[args.lat]),
        crs=args.crs)
    gdf.to_parquet(args.output_parquet, index=False)

    print(f'{args.input_csv} -> {args.output_parquet}')
    print(f'  入力 {total}行 / 出力 {len(gdf)}行'
          f'（座標欠損 {int(missing.sum())}行、座標0,0 {int(null_island.sum())}行を除外）')


if __name__ == '__main__':
    main()
