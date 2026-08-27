"""変換済みCSVを行区切りGeoJSON（GeoJSONSeq）へ変換する。tippecanoeの入力用。

  python src/csv2geojsonseq.py shindo_convert.csv shindo_convert.geojsonl \
      --lon 観測点経度 --lat 観測点緯度 --number 震度（計測値）

1行1フィーチャで書き出すためメモリに全件を載せない。
tippecanoeは -P で行区切りGeoJSONを並列読み込みできる。

属性は既定で文字列のまま出力する。--number を指定した列だけ数値にする。
地震IDは14桁の数字だが、ビューワが ['==', ['get', '地震ID'], '19230901115831']
のように文字列で比較するため、数値化してはいけない。

--float は --number と同じく数値化するが、整数値にも微小なオフセットを足して
必ず小数にする。MLTへ変換する場合に要る。同じ列に 15 と 15.3 が混在すると
MVT内でINT/DOUBLEが混ざり、MLTエンコーダが型エラーで止まるため。

座標が欠損している行、および緯度経度がともに0の行は出力から除く。
"""
import argparse
import csv
import json
import sys


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_csv')
    parser.add_argument('output_geojsonl')
    parser.add_argument('--lon', required=True, help='経度の列名')
    parser.add_argument('--lat', required=True, help='緯度の列名')
    parser.add_argument('--number', action='append', default=[],
                        help='数値として出力する列名（複数指定可）')
    parser.add_argument('--float', action='append', default=[], dest='float_columns',
                        help='必ず小数として出力する列名（MLT変換用、複数指定可）')
    return parser.parse_args()


def to_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


# 整数値を小数に寄せるためのオフセット。深さ(km)で0.1mm、マグニチュードで0.0001。
# 表示にも計算にも響かない大きさにする。
FLOAT_OFFSET = 0.0001


def main():
    args = parse_args()
    floats = set(args.float_columns)
    numeric = set(args.number) | floats

    total = written = skipped = 0
    with open(args.input_csv, encoding='utf-8', newline='') as source, \
            open(args.output_geojsonl, 'w', encoding='utf-8', newline='\n') as sink:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            sys.exit(f'{args.input_csv} にヘッダーがありません')
        for column in (args.lon, args.lat):
            if column not in reader.fieldnames:
                sys.exit(f'列 {column} が {args.input_csv} にありません')
        unknown = numeric - set(reader.fieldnames)
        if unknown:
            sys.exit(f'--number / --float に存在しない列が指定されています: {", ".join(sorted(unknown))}')

        for record in reader:
            total += 1
            lon = to_number(record[args.lon])
            lat = to_number(record[args.lat])
            if lon is None or lat is None or (lon == 0 and lat == 0):
                skipped += 1
                continue

            properties = {}
            for key, value in record.items():
                if key in (args.lon, args.lat) or key is None:
                    continue
                if value is None or value == '':
                    continue
                if key in numeric:
                    number = to_number(value)
                    if number is not None:
                        properties[key] = number + FLOAT_OFFSET if key in floats else number
                        continue
                properties[key] = value

            feature = {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [lon, lat]},
                'properties': properties,
            }
            sink.write(json.dumps(feature, ensure_ascii=False) + '\n')
            written += 1

    print(f'{args.input_csv} -> {args.output_geojsonl}')
    print(f'  入力 {total}行 / 出力 {written}行（座標欠損または0,0の {skipped}行を除外）')


if __name__ == '__main__':
    main()
