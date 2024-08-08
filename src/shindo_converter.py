import pandas as pd
import numpy as np

# 入力CSVファイル名
input_csv_file = "shindo.csv"

# 出力CSVファイル名
output_csv_file = "shindo_convert.csv"

# 観測点情報CSVファイル名
observation_csv_file = "code_p.csv"

# CSVファイルを読み込み
df = pd.read_csv(input_csv_file, encoding='shift_jis')
print(df.head(5))

# 観測点情報を読み込み
df_obs = pd.read_csv(observation_csv_file, encoding='shift_jis')

# DataFrameを観測点番号でマージ
df = df.merge(df_obs[['観測点番号', '震度発表名称', '観測点緯度', '観測点経度']],
              on='観測点番号', how='left')

# 変換関数を定義
# 日時の変換


def format_seconds(seconds_str):
    # 空白削除、右0埋め
    seconds_str = seconds_str.replace('/', '')
    seconds_str = seconds_str.strip().ljust(3, '0')
    return float(seconds_str[:-1] + '.' + seconds_str[-1:])


# 秒の変換
df['発現秒'] = df['発現秒'].astype(str).apply(format_seconds)

# 地震IDから年と月を抽出
df['年'] = df['地震ID'].astype(str).str[:4].astype(int)
df['月'] = df['地震ID'].astype(str).str[4:6].astype(int)

# DateTimeオブジェクトを作成
df['DateTime'] = pd.to_datetime(df[['年', '月', '発現日', '発現時', '発現分', '発現秒']].rename(columns={
                                '年': 'year', '月': 'month', '発現日': 'day', '発現時': 'hour', '発現分': 'minute', '発現秒': 'second'}), errors='coerce')

# DateTime列を指定された形式の文字列に変換


def format_datetime(x):
    if not isinstance(x, str) and x is not pd.NaT:
        return x.strftime('%Y-%m-%d %H:%M:%S.%f')[:-5]
    else:
        return x


df['DateTime'] = df['DateTime'].apply(format_datetime)

# '発現日'に'//'が含まれる場合、'DateTime'を'//'に設定
df.loc[df['発現日'].astype(str).str.contains('//'), 'DateTime'] = '//'
df.loc[df['発現時'].astype(str).str.contains('//'), 'DateTime'] = '//'
df.loc[df['発現分'].astype(str).str.contains('//'), 'DateTime'] = '//'
df.loc[df['発現秒'].astype(str).str.contains('//'), 'DateTime'] = '//'

# 震度の変換


def convert_shindo(shindo):
    if shindo == 'A':
        return '5-'
    elif shindo == 'B':
        return '5+'
    elif shindo == 'C':
        return '6-'
    elif shindo == 'D':
        return '6+'
    else:
        return shindo


df['震度'] = df['震度'].apply(convert_shindo)


def format_shindo_keisoku(shindo_keisoku):
    if shindo_keisoku != '//':
        int_shindo_keisoku = int(shindo_keisoku)
        shindo_keisoku = str(int_shindo_keisoku / 10)
    return shindo_keisoku


# 震度（計測値）の変換
df['震度（計測値）'] = df['震度（計測値）'].astype(str).apply(format_shindo_keisoku)

# 結果を新しいCSVファイルに出力
df[['地震ID', '観測点番号', '震度発表名称', '観測点緯度', '観測点経度', '発現日', '発現時', '発現分',
    '発現秒', 'DateTime', '震度', '震度（計測値）']].to_csv(output_csv_file, index=False)
