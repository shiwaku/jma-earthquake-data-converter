import os
import csv

input_folder = './dat'
output_file = 'hypocenter.csv'
output_file_unmatched = 'shindo.csv'

# CSVヘッダーの定義
csv_header = [
    "地震ID", "レコード種別", "西暦", "月", "日", "時", "分", "秒", "標準誤差(秒)", "緯度(度)", "緯度(分)", "標準誤差(分)", "経度(度)",
    "経度(分)", "標準誤差(分)", "深さ(km)", "標準誤差(km)", "マグニチュード1", "マグニチュード1種別", "マグニチュード2",
    "マグニチュード2種別", "使用走時表", "震源評価", "震源補助情報", "最大震度", "被害規模", "津波規模", "大地域区分番号",
    "小地域区分番号", "震央地名", "観測点数", "震源決定フラグ"
]

unmatched_csv_header = [
    "地震ID", "観測点番号", "発現日", "発現時", "発現分", "発現秒", "震度", "震度（計測値）", "最大加速度発現分", "最大加速度発現秒", "最大加速度（合成値）",
    "指示フラグ", "最大加速度(南北成分)", "指示フラグ", "最大加速度(東西成分)", "指示フラグ", "最大加速度(上下成分)", "指示フラグ", "最大加速度周期（南北成分）",
    "指示フラグ", "卓越周期（南北成分）", "指示フラグ", "最大加速度周期（東西成分）", "指示フラグ", "卓越周期（東西成分）", "指示フラグ", "最大加速度周期（上下成分）", "指示フラグ", "卓越周期（上下成分）"
]

record_counter = 0


def format_seconds(seconds_str):
    # 空白削除、右0埋め
    seconds_str = seconds_str.strip().ljust(4, '0')
    return seconds_str


with open(output_file, 'w', encoding='shift_jis', newline='') as csvfile,\
        open(output_file_unmatched, 'w', encoding='shift_jis', newline='') as unmatched_csvfile:

    # ヘッダー行出力
    csv_writer = csv.writer(csvfile)
    csv_writer.writerow(csv_header)

    unmatched_csv_writer = csv.writer(unmatched_csvfile)
    unmatched_csv_writer.writerow(unmatched_csv_header)

    for file in os.listdir(input_folder):
        if file.endswith('.dat'):
            input_file = os.path.join(input_folder, file)

            # Shift-JISエンコーディングでファイルを開く
            with open(input_file, 'rb') as infile:
                lines = infile.readlines()
                line_idx = 0
                while line_idx < len(lines):
                    line_bytes = lines[line_idx]
                    if line_bytes.startswith(b'A') or line_bytes.startswith(b'B') or line_bytes.startswith(b'D'):
                        # 震源決定フラグがK:気象庁震源
                        # if line_bytes[95:96].decode('shift_jis').strip() == 'K':
                        # 地震ID作成
                        seconds = line_bytes[13:17].decode('shift_jis')
                        seconds = format_seconds(seconds)
                        seconds = seconds[0:2]
                        id = line_bytes[1:5].decode('shift_jis') + line_bytes[5:7].decode('shift_jis') + line_bytes[7:9].decode(
                            'shift_jis') + line_bytes[9:11].decode('shift_jis') + line_bytes[11:13].decode('shift_jis') + seconds
                        # print('地震ID: ' + id)
                        # 各バイト列をShift-JISエンコーディングで文字列に変換
                        record = [
                            id,
                            line_bytes[0:1].decode('shift_jis'),
                            line_bytes[1:5].decode('shift_jis'),
                            line_bytes[5:7].decode('shift_jis'),
                            line_bytes[7:9].decode('shift_jis'),
                            line_bytes[9:11].decode('shift_jis'),
                            line_bytes[11:13].decode('shift_jis'),
                            line_bytes[13:17].decode('shift_jis'),
                            line_bytes[17:21].decode('shift_jis'),
                            line_bytes[21:24].decode('shift_jis'),
                            line_bytes[24:28].decode('shift_jis'),
                            line_bytes[28:32].decode('shift_jis'),
                            line_bytes[32:36].decode('shift_jis'),
                            line_bytes[36:40].decode('shift_jis'),
                            line_bytes[40:44].decode('shift_jis'),
                            line_bytes[44:49].decode('shift_jis'),
                            line_bytes[49:52].decode('shift_jis'),
                            line_bytes[52:54].decode('shift_jis'),
                            line_bytes[54:55].decode('shift_jis'),
                            line_bytes[55:57].decode('shift_jis'),
                            line_bytes[57:58].decode('shift_jis'),
                            line_bytes[58:59].decode('shift_jis'),
                            line_bytes[59:60].decode('shift_jis'),
                            line_bytes[60:61].decode('shift_jis'),
                            line_bytes[61:62].decode('shift_jis'),
                            line_bytes[62:63].decode('shift_jis'),
                            line_bytes[63:64].decode('shift_jis'),
                            line_bytes[64:65].decode('shift_jis'),
                            line_bytes[65:68].decode('shift_jis'),
                            line_bytes[68:90].decode('shift_jis'),
                            line_bytes[90:95].decode('shift_jis'),
                            line_bytes[95:96].decode('shift_jis')
                        ]

                        # CSVに行を追加
                        csv_writer.writerow(record)

                        # 観測点数を取得
                        if line_bytes[90:95].decode('shift_jis') == '     ':
                            num_points = 0
                        else:
                            num_points = int(
                                line_bytes[90:95].decode('shift_jis'))

                        # 観測点数分だけ次の行を読み込む
                        for i in range(num_points):
                            line_idx += 1
                            if line_idx < len(lines):
                                unmatched_line_bytes = lines[line_idx]

                                # 震源レコードの１番上のレコードが代表値（採用値）以外は読み飛ばし
                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                if unmatched_line_bytes.startswith(b'A') or unmatched_line_bytes.startswith(b'B') or unmatched_line_bytes.startswith(b'D'):
                                    line_idx += 1
                                    unmatched_line_bytes = lines[line_idx]

                                # ここで unmatched_line_bytes を解析して、unmatched_csv_writer.writerow に適切なデータを渡す
                                unmatched_record = [
                                    id,
                                    unmatched_line_bytes[0:7].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[8:10].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[10:12].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[12:14].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[14:17].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[18:19].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[20:22].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[23:25].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[25:28].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[29:34].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[35:36].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[36:41].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[42:43].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[43:48].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[49:50].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[50:55].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[56:57].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[57:60].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[60:61].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[61:64].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[64:65].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[65:68].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[68:69].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[69:72].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[72:73].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[73:76].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[76:77].decode(
                                        'shift_jis'),
                                    unmatched_line_bytes[77:80].decode(
                                        'shift_jis')
                                ]
                                unmatched_csv_writer.writerow(
                                    unmatched_record)
                    line_idx += 1
