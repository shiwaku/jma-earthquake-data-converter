"""気象庁の震源データ（h*.dat）を読みやすいCSVへ変換する。

  python src/hypo_dat_converter.py work/hypo work/hypocenter_catalog.csv

震源データは震度データ（i*.dat）とは別の配信物で、震度が観測されなかった地震
（無感地震）も含む。
  震度データ: 1地震＝震源レコード（1件以上）＋震度・加速度レコード（1件以上）
  震源データ: 1地震＝震源レコード（1行）のみ
どちらも96バイト固定長の「Ｊ」形式で、震源レコードの桁位置は共通。
仕様: https://www.data.jma.go.jp/eqev/data/bulletin/data/format/fmthyp_j.html

出力は震度データ由来の hypocenter_convert.csv と同じ列名に揃えてある。ただし
震源データの震央地名は**英語**である点が異なる（例: E OFF FUKUSHIMA PREF）。

最大震度が空白の行が無感地震。ビューワはこれで有感／無感を分ける。
"""
import argparse
import csv
import glob
import os
import sys
import zipfile
from datetime import datetime, timedelta, timezone

# 桁位置は仕様の1始まり。スライスは0始まりなので -1 する。
JST = timezone(timedelta(hours=9))
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)

# 震源決定フラグ。K:気象庁 以外も含めてそのまま出す。
FIELDS = [
    '地震ID', 'レコード種別', 'DateTime', 'UnixTime', 'Latitude', 'Longitude',
    '深さ(km)', 'マグニチュード1', 'マグニチュード2', '最大震度', '震央地名',
    '観測点数', '震源決定フラグ',
]


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input_dir', help='h*.zip または h*.dat を置いたディレクトリ')
    parser.add_argument('output_csv')
    parser.add_argument('--types', default='JU',
                        help='取り込むレコード種別（既定: JU）')
    return parser.parse_args()


def field(line, start, end):
    """仕様の桁位置（1始まり・両端含む）で切り出す。"""
    return line[start - 1:end]


def to_int(text):
    text = text.strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def to_deg(deg_text, min_text):
    """度と分（分は1/100単位の整数表記）から十進度へ。"""
    deg = to_int(deg_text)
    minutes = to_int(min_text)
    if deg is None:
        return None
    value = abs(deg) + (minutes or 0) / 100.0 / 60.0
    return -value if deg_text.strip().startswith('-') else value


def to_magnitude(text):
    """M2.1桁表記。負値は -1→-0.1、A0→-2.0、B0→-3.0 のように符号化される。"""
    text = text.strip()
    if not text:
        return None
    head = text[0]
    if head.isdigit():
        return int(text) / 10.0
    # A/B/C は -2/-3/-4 の位を表す
    base = {'A': -2.0, 'B': -3.0, 'C': -4.0}.get(head.upper())
    if base is None:
        return None
    rest = to_int(text[1:]) or 0
    return base - rest / 10.0


def to_depth(text):
    """深さ。F5.2（1/100km単位）または I3+空白2（1km単位）の2通りがある。"""
    raw = text.rstrip()
    if not raw.strip():
        return None
    if text.endswith('  '):
        # 深さ固定・刻みの条件で決めた場合。先頭3桁がkm
        return float(to_int(text[:3]) or 0)
    value = to_int(text)
    return None if value is None else value / 100.0


def parse_line(line):
    kind = field(line, 1, 1)
    year = to_int(field(line, 2, 5))
    month = to_int(field(line, 6, 7))
    day = to_int(field(line, 8, 9))
    if not year or not month or not day:
        return None
    hour = to_int(field(line, 10, 11)) or 0
    minute = to_int(field(line, 12, 13)) or 0
    sec_raw = to_int(field(line, 14, 17)) or 0
    second, hundredth = divmod(sec_raw, 100)

    # 秒が60以上になる記録があるため timedelta で吸収する
    try:
        base = datetime(year, month, day, tzinfo=JST)
    except ValueError:
        return None
    when = base + timedelta(hours=hour, minutes=minute,
                            seconds=second, milliseconds=hundredth * 10)

    lat = to_deg(field(line, 22, 24), field(line, 25, 28))
    lon = to_deg(field(line, 33, 36), field(line, 37, 40))
    shindo = field(line, 62, 62).strip()

    return {
        # 地震IDは震度データ側と同じ作り方（発生時刻の14桁）
        '地震ID': f'{year:04d}{month:02d}{day:02d}{hour:02d}{minute:02d}{second % 60:02d}',
        'レコード種別': kind,
        'DateTime': when.strftime('%Y-%m-%d %H:%M:%S.') + f'{hundredth * 10:03d}',
        'UnixTime': int((when - EPOCH).total_seconds()),
        'Latitude': f'{lat:.4f}' if lat is not None else '',
        'Longitude': f'{lon:.4f}' if lon is not None else '',
        '深さ(km)': to_depth(field(line, 45, 49)),
        'マグニチュード1': to_magnitude(field(line, 53, 54)),
        'マグニチュード2': to_magnitude(field(line, 56, 57)),
        '最大震度': shindo,
        '震央地名': field(line, 69, 90).strip(),
        '観測点数': to_int(field(line, 91, 95)),
        '震源決定フラグ': field(line, 96, 96).strip(),
    }


def iter_lines(path):
    if path.endswith('.zip'):
        with zipfile.ZipFile(path) as archive:
            for name in archive.namelist():
                for raw in archive.read(name).split(b'\n'):
                    yield raw
    else:
        with open(path, 'rb') as handle:
            for raw in handle:
                yield raw


def main():
    args = parse_args()
    kinds = set(args.types)

    sources = sorted(glob.glob(os.path.join(args.input_dir, 'h*.zip')))
    sources += sorted(glob.glob(os.path.join(args.input_dir, 'h*.dat')))
    if not sources:
        sys.exit(f'{args.input_dir} に h*.zip / h*.dat がありません')

    total = written = felt = skipped = 0
    with open(args.output_csv, 'w', encoding='utf-8', newline='\n') as sink:
        writer = csv.DictWriter(sink, fieldnames=FIELDS, lineterminator='\n')
        writer.writeheader()
        for path in sources:
            for raw in iter_lines(path):
                if len(raw) < 96:
                    continue
                total += 1
                line = raw[:96].decode('latin1')
                if line[0] not in kinds:
                    skipped += 1
                    continue
                record = parse_line(line)
                if record is None:
                    skipped += 1
                    continue
                writer.writerow(record)
                written += 1
                if record['最大震度']:
                    felt += 1

    print(f'{len(sources)}ファイル / {total:,}行を読み、{written:,}行を書き出した', file=sys.stderr)
    print(f'  有感（最大震度あり）: {felt:,}', file=sys.stderr)
    print(f'  無感              : {written - felt:,}', file=sys.stderr)
    if skipped:
        print(f'  対象外・解析不能  : {skipped:,}', file=sys.stderr)


if __name__ == '__main__':
    main()
