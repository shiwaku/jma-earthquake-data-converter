import requests
import os

# ダウンロードするzipファイルの範囲を指定
start_year = 1919
end_year = 2020

# 保存先フォルダを指定（存在しない場合は作成）
download_folder = "./zip"
if not os.path.exists(download_folder):
    os.makedirs(download_folder)

# 指定された範囲のzipファイルをダウンロード
for year in range(end_year, start_year - 1, -1):
    url = f"https://www.data.jma.go.jp/eqev/data/bulletin/data/shindo/i{year}.zip"
    response = requests.get(url)

    # レスポンスが成功した場合のみ、ファイルを保存
    if response.status_code == 200:
        file_path = os.path.join(download_folder, f"i{year}.zip")
        with open(file_path, "wb") as f:
            f.write(response.content)
        print(f"i{year}.zip has been downloaded.")
    else:
        print(f"Failed to download i{year}.zip. Status code: {response.status_code}")

print("Download complete.")
