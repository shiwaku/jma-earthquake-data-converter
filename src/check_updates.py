"""気象庁の震度データ配信状況を監視し、前回記録との差分を報告する。

data/jma_manifest.json に記録した各zipのサイズとLast-Modifiedを、
気象庁サイトの現在の状態と照合する。

  python src/check_updates.py           差分を表示（0:差分なし 1:差分あり 2:失敗）
  python src/check_updates.py --update  マニフェストを現在の状態で更新

気象庁は年別zipをディレクトリ単位で一括再生成することがあるため、
新年度の追加だけでなく既存年の差し替えも検知対象とする。
"""
import argparse
import json
import os
import re
import sys

import requests

INDEX_URL = 'https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html'
BASE_URL = 'https://www.data.jma.go.jp/eqev/data/bulletin/data/shindo/'
MANIFEST_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'data', 'jma_manifest.json')


def list_remote_files(session):
    """配信ページから対象zipのファイル名を取得する。"""
    response = session.get(INDEX_URL, timeout=60)
    response.raise_for_status()
    response.encoding = response.apparent_encoding
    names = re.findall(r'href="\./data/shindo/(i\d{4}\.zip|code_p\.zip)"',
                       response.text)
    if not names:
        raise RuntimeError('配信ページからzipのリンクを取得できませんでした')
    # 重複除去のうえ、code_p.zipを先頭に、年別zipを昇順に並べる
    unique = sorted(set(names))
    return sorted(unique, key=lambda n: (n != 'code_p.zip', n))


def fetch_state(session, names):
    """各zipのサイズとLast-Modifiedを取得する。"""
    state = {}
    for name in names:
        response = session.head(BASE_URL + name, timeout=60)
        response.raise_for_status()
        state[name] = {
            'size': response.headers.get('Content-Length'),
            'last_modified': response.headers.get('Last-Modified'),
        }
    return state


def load_manifest():
    if not os.path.exists(MANIFEST_PATH):
        return {}
    with open(MANIFEST_PATH, encoding='utf-8') as file:
        return json.load(file).get('files', {})


def save_manifest(state):
    payload = {
        'source': INDEX_URL,
        'note': 'src/check_updates.py が生成・更新する。手で編集しない。',
        'files': state,
    }
    with open(MANIFEST_PATH, 'w', encoding='utf-8', newline='\n') as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write('\n')


def diff_state(previous, current):
    """(追加, 削除, 変更) を返す。"""
    added = sorted(set(current) - set(previous))
    removed = sorted(set(previous) - set(current))
    changed = sorted(name for name in set(previous) & set(current)
                     if previous[name] != current[name])
    return added, removed, changed


def format_report(previous, current, added, removed, changed):
    lines = []
    if added:
        lines.append('### 追加')
        for name in added:
            info = current[name]
            lines.append(f'- `{name}` — {info["size"]}B / {info["last_modified"]}')
    if changed:
        lines.append('### 差し替え')
        for name in changed:
            before, after = previous[name], current[name]
            lines.append(f'- `{name}`')
            lines.append(f'  - 前: {before["size"]}B / {before["last_modified"]}')
            lines.append(f'  - 後: {after["size"]}B / {after["last_modified"]}')
    if removed:
        lines.append('### 削除')
        for name in removed:
            lines.append(f'- `{name}`')
    return '\n'.join(lines)


def write_github_output(changed, report):
    """GitHub Actions から参照できるよう出力を書き出す。"""
    output_path = os.environ.get('GITHUB_OUTPUT')
    if not output_path:
        return
    with open(output_path, 'a', encoding='utf-8') as file:
        file.write(f'changed={"true" if changed else "false"}\n')
    if report:
        with open('jma_update_report.md', 'w', encoding='utf-8') as file:
            file.write(report + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--update', action='store_true',
                        help='マニフェストを現在の状態で更新する')
    args = parser.parse_args()

    session = requests.Session()
    names = list_remote_files(session)
    current = fetch_state(session, names)
    previous = load_manifest()

    if not previous:
        print(f'マニフェストが無いため新規作成します（{len(current)}件）')
        save_manifest(current)
        write_github_output(False, '')
        return 0

    added, removed, changed = diff_state(previous, current)
    if not (added or removed or changed):
        print(f'差分なし（{len(current)}件を照合）')
        write_github_output(False, '')
        return 0

    report = format_report(previous, current, added, removed, changed)
    print(f'差分あり: 追加{len(added)}件 / 差し替え{len(changed)}件 / 削除{len(removed)}件\n')
    print(report)
    write_github_output(True, report)

    if args.update:
        save_manifest(current)
        print('\nマニフェストを更新しました')
    return 1


if __name__ == '__main__':
    # 0:差分なし / 1:差分あり / 2:照合失敗
    # 「差分あり」と「実行エラー」を呼び出し側で区別できるようにする
    try:
        sys.exit(main())
    except Exception as error:
        print(f'照合に失敗しました: {error}', file=sys.stderr)
        sys.exit(2)
