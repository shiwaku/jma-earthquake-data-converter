import pandas as pd
import numpy as np

# 入力CSVファイル名
input_csv_file = "hypocenter.csv"

# 出力CSVファイル名
output_csv_file = "hypocenter_convert.csv"

# CSVファイルを読み込み
df = pd.read_csv(input_csv_file, encoding='shift_jis', dtype=str)
print(df.head(5))

# 変換関数を定義
# 日時の変換


def format_seconds(seconds_str):
    # 空白削除、右0埋め
    seconds_str = seconds_str.strip().ljust(4, '0')
    return float(seconds_str[:-2] + '.' + seconds_str[-2:])

# 緯度と経度の変換


def format_minutes(minutes_str):
    # 空白削除、右0埋め
    minutes_str = minutes_str.strip().ljust(4, '0')
    return float(minutes_str[:-2] + '.' + minutes_str[-2:])

# 深さの変換


def format_depth(depth_str):
    depth_str = depth_str.replace(' ', '0')
    return float(depth_str[:-2] + '.' + depth_str[-2:])

# マグニチュードの変換


def format_mag(mag_str):
    if mag_str != '  ':
        return float(int(mag_str) / 10)

# 空白の削除


def format_blank(str):
    # 空白削除
    str = str.strip()
    return str

# 震度の変換


def convert_shindo(shindo):
    if shindo == 'A':
        return '5弱'
    elif shindo == 'B':
        return '5強'
    elif shindo == 'C':
        return '6弱'
    elif shindo == 'D':
        return '6強'
    else:
        return shindo


# 秒の変換
df['秒'] = df['秒'].astype(str).apply(format_seconds)

# 地震ID作成
df['地震ID'] = df['西暦'].astype(str) + df['月'].apply(lambda x: str(x).zfill(2)) + df['日'].apply(lambda x: str(x).zfill(2)) + df['時'].apply(
    lambda x: str(x).zfill(2)) + df['分'].apply(lambda x: str(x).zfill(2)) + df['秒'].apply(lambda x: str(int(x)).zfill(2))

df['DateTime'] = pd.to_datetime(df[['西暦', '月', '日', '時', '分', '秒']].rename(columns={
    '西暦': 'year', '月': 'month', '日': 'day', '時': 'hour', '分': 'minute', '秒': 'second'}))

# UnixTimeへの変換
df['DateTimeUTC'] = df['DateTime'].dt.tz_localize(
    'Asia/Tokyo', ambiguous='NaT', nonexistent='shift_forward').dt.tz_convert('UTC')
df['UnixTime'] = (df['DateTimeUTC'] -
                  pd.Timestamp("1970-01-01", tz='UTC')) // pd.Timedelta('1s')

# 度単位への変換
df['緯度(分)'] = df['緯度(分)'].astype(str).apply(format_minutes)
df['経度(分)'] = df['経度(分)'].astype(str).apply(format_minutes)

df['緯度(度)'] = pd.to_numeric(df['緯度(度)'], errors='coerce')
df['経度(度)'] = pd.to_numeric(df['経度(度)'], errors='coerce')

df['Latitude'] = round(df['緯度(度)'] + df['緯度(分)'] / 60, 4)
df['Longitude'] = round(df['経度(度)'] + df['経度(分)'] / 60, 3)

# 深さの変換
df['深さ(km)'] = df['深さ(km)'].astype(str).apply(format_depth)

# マグニチュード1の変換
df['マグニチュード1'] = df['マグニチュード1'].astype(str).apply(format_mag)

# マグニチュード2の変換
df['マグニチュード2'] = df['マグニチュード2'].astype(str).apply(format_mag)

# 震央地名の空白削除
df['震央地名'] = df['震央地名'].astype(str).apply(format_blank)

# 震央地名の空白削除
df['観測点数'] = df['観測点数'].astype(str).apply(format_blank)

# 最大震度の変換
df['最大震度'] = df['最大震度'].astype(str).apply(convert_shindo)

# 結果を新しいCSVファイルに出力
df[['地震ID', 'レコード種別', 'DateTime', 'UnixTime', 'Latitude', 'Longitude',
    '深さ(km)', 'マグニチュード1', 'マグニチュード2', '最大震度', '震央地名', '観測点数', '震源決定フラグ']].to_csv(output_csv_file, index=False)

print("処理終了")
