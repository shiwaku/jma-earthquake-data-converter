"""震源CSV・震度CSVからビューワの検索用インデックス（events.json）を作る。

  python src/build_event_index.py work/hypocenter_convert.csv viewer/public/events.json \
      --shindo-csv work/shindo_convert.csv --min-shindo 3

旧ビューワは表示できる地震が14件のハードコードだった。その解消のために、
震源データ全件（214,763件）から「地図に出す意味のある地震」だけを抜き出す。

全件を索引にするとJSONが十数MBになりブラウザに載らない。最大震度で足切りする。
既定の3以上で15,480件。4以上なら3,285件まで落ちる。
最大震度は '1'〜'4' と '5弱'/'5強'/'6弱'/'6強'/'7'、および1996年10月の
震度階級改定より前の '5'/'6'（強弱の区別なし）が混在するため、
SHINDO_ORDER で順序を与えて比較する。

地震IDは一意ではない。214,763件に対し異なるIDは208,552個で、5,406個のIDが
重複する。IDが発生時刻（YYYYMMDDhhmmss）そのものであるため、同じ秒に決定された
別レコードが同じIDになる。ビューワは地震IDでフィルタする以上それらを区別できないので、
索引側でも最大震度が最も大きいものを代表として1件に畳む。

bbox は「ビューワがカメラを寄せる範囲」で、旧ビューワが14件分だけ手で持っていた
中心座標とズームの表の代わりになる。有感の全観測点を囲うと、M9や2016年熊本のように
全国で有感となった地震で日本全体まで引いてしまい、肝心の強い揺れの分布が見えない。
そのため「最大震度から2階級以内（かつ震度4以上）の観測点」だけを囲う。
そこに震源の位置を足すので、震源が沖合にある地震（2011年東北地方太平洋沖など）でも
震源の×印が画面に入る。
観測点 5399999「神戸市等阪神淡路地域」は座標が 0,0 のため bbox から除く
（1995年兵庫県南部地震の震度7が面的判定であることによるもので、データ側の性質）。

震度の表記は2つのファイルで異なる。震源CSVの最大震度は '5弱'/'6強'、
震度CSVの震度は '5-'/'6+' を使う。SHINDO_ORDER は両方を受ける。
震度 '9' は有感だが階級不明を表すため、順序を持たせず bbox から除く。

出力は配列の配列にする。キー名を1件ごとに繰り返さないぶん小さく、
gzip後のサイズもオブジェクト形式より素直に効く。列名は fields に持たせる。
"""
import argparse
import csv
import json
import sys

# 足切り比較のための震度の順序。改定前の '5'/'6' は弱・強の下限として扱う。
# 震源CSVの '5弱' と震度CSVの '5-' は同じ階級。どちらの表記も引けるようにする。
SHINDO_ORDER = {
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '5弱': 5, '5-': 5, '5強': 6, '5+': 6,
    '6': 7, '6弱': 7, '6-': 7, '6強': 8, '6+': 8,
    '7': 9,
}

# 強い揺れとみなす下限。最大震度からこれだけ下までを bbox に含める。
STRONG_MARGIN = 2
# ただし震度4より下は含めない（有感範囲まで広がってしまうため）。
STRONG_FLOOR = SHINDO_ORDER['4']

FIELDS = ['id', 'name', 'mag', 'shindo', 'depth', 'stations', 'bbox']

# bbox はカメラを寄せるためだけに使う。小数2桁（約1km）あれば足りる。
BBOX_DIGITS = 2
DEPTH_DIGITS = 1


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_csv')
    parser.add_argument('output_json')
    parser.add_argument('--shindo-csv',
                        help='震度CSV。指定すると震度観測点の外接矩形を bbox に含める')
    parser.add_argument('--min-shindo', default='3',
                        help='索引に含める最大震度の下限（既定: 3）')
    parser.add_argument('--indent', action='store_true',
                        help='人が読める形に整形して出力する（サイズは増える）')
    return parser.parse_args()


def to_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def read_hypocenters(path, threshold):
    """最大震度が threshold 以上の地震を、地震IDをキーにして読み出す。"""
    events = {}
    duplicates = 0
    skipped_unknown = 0
    with open(path, encoding='utf-8', newline='') as f:
        for row in csv.DictReader(f):
            shindo = (row['最大震度'] or '').strip()
            rank = SHINDO_ORDER.get(shindo)
            if rank is None:
                skipped_unknown += 1
                continue
            if rank < threshold:
                continue

            stations = to_number(row['観測点数']) or 0
            event_id = row['地震ID']
            current = events.get(event_id)
            if current is not None:
                duplicates += 1
                # 同じIDの別レコード。震度の大きいほう、同じなら観測点の多いほうを残す。
                if (rank, stations) <= (current['rank'], current['stations']):
                    continue

            depth = to_number(row['深さ(km)'])
            events[event_id] = {
                'name': row['震央地名'],
                'mag': to_number(row['マグニチュード1']),
                'shindo': shindo,
                'rank': rank,
                # 最大震度から2階級以内、ただし震度4以上。最大震度が震度3以下の
                # 地震ではその階級そのものが下限になる（min で頭打ちにする）。
                'strong_floor': min(rank, max(STRONG_FLOOR, rank - STRONG_MARGIN)),
                'depth': round(depth, DEPTH_DIGITS) if depth is not None else None,
                # 震源の座標は bbox に畳んでしまうので、そのままは出力しない。
                # 震源が決定できていない地震は座標を持たない。
                'lat': to_number(row['Latitude']),
                'lng': to_number(row['Longitude']),
                'stations': stations,
            }
    return events, duplicates, skipped_unknown


def extend(boxes, event_id, lng, lat):
    box = boxes.get(event_id)
    if box is None:
        boxes[event_id] = [lng, lat, lng, lat]
        return
    if lng < box[0]:
        box[0] = lng
    if lat < box[1]:
        box[1] = lat
    if lng > box[2]:
        box[2] = lng
    if lat > box[3]:
        box[3] = lat


def build_bboxes(events, shindo_csv):
    """各地震の表示範囲を作る。強く揺れた観測点の外接矩形に震源を足したもの。"""
    strong = {}
    # 強い揺れの観測点が1点も取れなかったとき（震源CSVの最大震度と震度CSVが
    # 食い違う場合など）に備えて、有感の全観測点の矩形も並行して作る。
    felt = {}

    if shindo_csv:
        # 1行ずつ畳み込むため、203MBの震度CSVでも全件をメモリに載せない。
        with open(shindo_csv, encoding='utf-8', newline='') as f:
            for row in csv.DictReader(f):
                event_id = row['地震ID']
                event = events.get(event_id)
                if event is None:
                    continue
                lat = to_number(row['観測点緯度'])
                lng = to_number(row['観測点経度'])
                if lat is None or lng is None or (lat == 0 and lng == 0):
                    continue
                extend(felt, event_id, lng, lat)
                rank = SHINDO_ORDER.get((row['震度'] or '').strip())
                if rank is not None and rank >= event['strong_floor']:
                    extend(strong, event_id, lng, lat)

    boxes = {}
    for event_id, event in events.items():
        box = strong.get(event_id) or felt.get(event_id)
        if box is not None:
            boxes[event_id] = list(box)
        if event['lat'] is not None and event['lng'] is not None:
            extend(boxes, event_id, event['lng'], event['lat'])

    return boxes, len(strong), len(felt)


def main():
    args = parse_args()

    if args.min_shindo not in SHINDO_ORDER:
        sys.exit(f'--min-shindo の値が不正: {args.min_shindo}')
    threshold = SHINDO_ORDER[args.min_shindo]

    events, duplicates, skipped_unknown = read_hypocenters(args.input_csv, threshold)
    print(f'{len(events)}件を抽出した（最大震度{args.min_shindo}以上）', file=sys.stderr)
    if duplicates:
        print(f'地震IDが重複する{duplicates}件は代表1件に畳んだ', file=sys.stderr)

    boxes, strong, felt = build_bboxes(events, args.shindo_csv)
    if args.shindo_csv:
        print(f'うち{strong}件は強く揺れた観測点で表示範囲を決めた', file=sys.stderr)
        if felt > strong:
            print(f'{felt - strong}件は有感の全観測点にひろげた', file=sys.stderr)

    rows = []
    for event_id in sorted(events):
        e = events[event_id]
        box = boxes.get(event_id)
        rows.append([
            event_id, e['name'], e['mag'], e['shindo'], e['depth'], e['stations'],
            [round(v, BBOX_DIGITS) for v in box] if box else None,
        ])

    index = {
        'minShindo': args.min_shindo,
        'count': len(rows),
        'fields': FIELDS,
        'events': rows,
    }
    with open(args.output_json, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False,
                  indent=2 if args.indent else None,
                  separators=None if args.indent else (',', ':'))

    no_box = sum(1 for r in rows if r[6] is None)
    if no_box:
        print(f'{no_box}件は表示範囲を決められなかった', file=sys.stderr)
    if skipped_unknown:
        print(f'最大震度が不明な{skipped_unknown}件を除外した', file=sys.stderr)


if __name__ == '__main__':
    main()
