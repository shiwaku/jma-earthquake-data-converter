"""気象庁の震源データ（h*.zip）を一括ダウンロードする。

  python src/hypo_zip_dl.py                    配信中の全年
  python src/hypo_zip_dl.py --start 2015       2015年以降
  python src/hypo_zip_dl.py --end 2020         2020年まで

震度データ（shindo_zip_dl.py）とは配信ページが別で、収録年も異なる。
1919〜1950年などは複数年が1つのzipにまとまっているため、ファイル名の年は
「そのzipの先頭年」として扱う。
終了年を指定しない場合は配信ページから最新年を自動判定する。
"""
import argparse
import os
import sys

import requests

from check_updates import HYPO_BASE_URL, list_hypo_files

DOWNLOAD_FOLDER = './hypo_zip'


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', type=int, default=None,
                        help='取得開始年（既定: 配信されている最古の年）')
    parser.add_argument('--end', type=int, default=None,
                        help='取得終了年（既定: 配信されている最新年）')
    parser.add_argument('--dest', default=DOWNLOAD_FOLDER, help='保存先フォルダ')
    return parser.parse_args()


def main():
    args = parse_args()
    os.makedirs(args.dest, exist_ok=True)

    session = requests.Session()
    names = list_hypo_files(session)
    years = sorted(int(name[1:5]) for name in names)
    start = args.start if args.start is not None else years[0]
    end = args.end if args.end is not None else years[-1]
    targets = [f'h{year}.zip' for year in years if start <= year <= end]
    print(f'配信範囲 {years[0]}〜{years[-1]}年 のうち {start}〜{end}年（{len(targets)}ファイル）を取得します')

    failed = []
    for name in targets:
        response = session.get(HYPO_BASE_URL + name, timeout=300)
        if response.status_code != 200:
            print(f'{name} の取得に失敗しました。ステータスコード: {response.status_code}')
            failed.append(name)
            continue
        with open(os.path.join(args.dest, name), 'wb') as file:
            file.write(response.content)
        print(f'{name} をダウンロードしました。')

    if failed:
        sys.exit(f'取得に失敗しました: {", ".join(failed)}')
    print('ダウンロードが完了しました。')


if __name__ == '__main__':
    main()
