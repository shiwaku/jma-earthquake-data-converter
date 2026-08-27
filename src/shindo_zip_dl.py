"""気象庁の震度データ（zip形式）と震度観測点一覧を一括ダウンロードする。

  python src/shindo_zip_dl.py                    配信中の全年 + code_p.zip
  python src/shindo_zip_dl.py --start 2015       2015年以降
  python src/shindo_zip_dl.py --end 2020         2020年まで
  python src/shindo_zip_dl.py --no-code-p        年別zipのみ

終了年を指定しない場合は配信ページから最新年を自動判定するため、
新年度が公開されてもスクリプトを書き換える必要はない。
"""
import argparse
import os
import sys

import requests

from check_updates import BASE_URL, list_remote_files

DOWNLOAD_FOLDER = './zip'


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--start', type=int, default=1919, help='取得開始年')
    parser.add_argument('--end', type=int, default=None,
                        help='取得終了年（既定: 配信されている最新年）')
    parser.add_argument('--no-code-p', action='store_true',
                        help='震度観測点一覧を取得しない')
    parser.add_argument('--dest', default=DOWNLOAD_FOLDER, help='保存先フォルダ')
    return parser.parse_args()


def download(session, name, dest):
    response = session.get(BASE_URL + name, timeout=120)
    if response.status_code != 200:
        print(f'{name} の取得に失敗しました。ステータスコード: {response.status_code}')
        return False
    with open(os.path.join(dest, name), 'wb') as file:
        file.write(response.content)
    print(f'{name} をダウンロードしました。')
    return True


def main():
    args = parse_args()
    os.makedirs(args.dest, exist_ok=True)

    session = requests.Session()
    available = list_remote_files(session)
    years = sorted(int(name[1:5]) for name in available if name.startswith('i'))
    if not years:
        sys.exit('配信ページから年別zipを取得できませんでした')

    start = max(args.start, years[0])
    end = min(args.end, years[-1]) if args.end else years[-1]
    targets = [year for year in years if start <= year <= end]
    print(f'配信範囲 {years[0]}〜{years[-1]}年 のうち {start}〜{end}年 を取得します')

    failed = []
    for year in targets:
        if not download(session, f'i{year}.zip', args.dest):
            failed.append(f'i{year}.zip')

    if not args.no_code_p:
        if not download(session, 'code_p.zip', args.dest):
            failed.append('code_p.zip')

    if failed:
        sys.exit(f'取得に失敗しました: {", ".join(failed)}')
    print('ダウンロードが完了しました。')


if __name__ == '__main__':
    main()
