# jma-earthquake-data-converter

気象庁 [地震月報(カタログ編)](https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html) の震度データ（1919〜2022年）を、そのままでは扱えない固定長テキストから GIS データ（CSV / GeoParquet / PMTiles）へ変換し、地図で見られるようにします。

[![Demo](https://img.shields.io/badge/demo-震度マップ-2a78d6)](https://shiwaku.github.io/jma-earthquake-data-converter/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Data: CC BY 4.0](https://img.shields.io/badge/data-CC%20BY%204.0-green)](#ライセンス)

**[▶ デモサイトを開く](https://shiwaku.github.io/jma-earthquake-data-converter/)**

[![スクリーンショット](docs/screenshot.png)](https://shiwaku.github.io/jma-earthquake-data-converter/)

<sub>2016年4月16日 熊本県熊本地方（M7.3・最大震度7）の震度分布</sub>

## 収録データ

| | 件数 | 期間 |
|---|---:|---|
| 震源 | 214,763 | 1919〜2022年 |
| 震度（観測点ごと） | 1,942,347 | 1919〜2022年 |
| 震度観測点 | 7,239 | — |

リポジトリに含まれる [`data/code_p.csv`](data/code_p.csv) は7,087観測点の古いスナップショットです。最新にするには `shindo_zip_dl.py` と `code_p2csv.py` を実行してください。

ビューワからは最大震度3以上の **15,480件**の地震を、震央地名・年月日・マグニチュード・震度で検索できます。

## データの流れ

```mermaid
flowchart LR
  JMA["気象庁<br/>地震月報(カタログ編)"] -->|shindo_zip_dl.py| DAT[".dat<br/>固定長テキスト"]
  JMA -->|shindo_zip_dl.py| CODEP["code_p.dat<br/>観測点一覧"]
  CODEP -->|code_p2csv.py| CODECSV["code_p.csv"]
  DAT -->|dat_converter.py| RAW["hypocenter.csv<br/>shindo.csv"]
  RAW -->|hypocenter_converter.py| HYPO["hypocenter_convert.csv<br/>21MB / 214,763件"]
  RAW -->|shindo_converter.py| SHINDO["shindo_convert.csv<br/>203MB / 1,942,347件"]
  CODECSV -.観測点番号で結合.-> SHINDO
  HYPO --> GP["GeoParquet<br/>csv2geoparquet.py"]
  SHINDO --> GP
  HYPO --> PM["PMTiles<br/>csv2geojsonseq.py → tippecanoe"]
  SHINDO --> PM
  PM --> VIEWER["ビューワ<br/>viewer/"]
```

## クイックスタート

### ビューワだけ動かす

配信済みの PMTiles を読むので、変換は不要です。

```bash
cd viewer
npm ci
npm run dev
```

### データを自分で変換する

```bash
# 1. ダウンロード（配信ページから最新年を自動判定。--start / --end で範囲指定も可）
python src/shindo_zip_dl.py

# 2. 展開したうえで、震源データ・震度データを抽出
python src/dat_converter.py

# 3. 読みやすい形式へ
python src/code_p2csv.py
python src/hypocenter_converter.py
python src/shindo_converter.py
```

各スクリプトの詳細は[パイプライン](#パイプライン)を参照してください。

## 配信データ

PMTiles は Cloudflare R2 で配信しています。

| データ | URL | サイズ |
|---|---|---:|
| 震源 | `https://shi-works.com/pmtiles/jma-earthquake/hypocenter_convert.pmtiles` | 56MB |
| 震度 | `https://shi-works.com/pmtiles/jma-earthquake/shindo_convert.pmtiles` | 271MB |
| 人口集中地区（2020年） | `https://shi-works.com/pmtiles/r2DID/2020_did_ddsw_01-47_JGD2011.pmtiles` | 12.7MB |

PMTiles は [PMTiles Viewer](https://protomaps.github.io/PMTiles/) でも閲覧できます。

中間生成物（CSV・GeoParquet）は配布していません。上のクイックスタートで生成するか、`run-pipeline.yml` を手動実行すると GitHub Releases に公開されます。`shindo_convert.csv` は203MBあり、GitHubのファイルサイズ上限（100MB）を超えるためリポジトリには含められません。

## パイプライン

### 震度観測点一覧を読みやすい形式へ（`code_p2csv.py`）

観測点一覧（datファイル）をCSVに変換します。入力の文字コードは自動判定します（2022年配信分から Shift-JIS → EUC-JP に変更されました）。

- 入力: [`data/code_p.dat`](data/code_p.dat)
- 出力: [`data/code_p.csv`](data/code_p.csv)

### 震源データ・震度データの抽出（`dat_converter.py`）

震度データ（datファイル）から震源データと震度データを抽出します。

- 震源データは1番上のレコードが代表値（採用値）で、本プログラムは代表値のみ出力します
- 震源データの西暦・月・日・時・分・秒から**地震ID**を作り、震源データと震度データの双方に付与します

> [!NOTE]
> 地震IDは一意ではありません。214,763件に対し異なるIDは208,552個で、5,406個が重複します。IDが発生時刻 `YYYYMMDDhhmmss` そのものであるため、同じ秒に決定された別レコードが衝突します。

### 震源データを読みやすい形式へ（`hypocenter_converter.py`）

- 西暦・月・日・時・分・秒から `DateTime` と `UnixTime` を作ります
- 緯度(度)・緯度(分)・経度(度)・経度(分)から `Latitude` / `Longitude` を作ります

### 震度データを読みやすい形式へ（`shindo_converter.py`）

- 観測点番号をキーに、観測点一覧から震度発表名称・観測点緯度・観測点経度を付与します
- 地震ID（年月）と発現日・時・分・秒から `DateTime` を作ります

> [!NOTE]
> 観測点 `5399999`「神戸市等阪神淡路地域」は座標が 0,0 です。1995年兵庫県南部地震の震度7が面的判定によるもので、そのままGISデータ化するとNull Islandに現れます。後段の `csv2geoparquet.py` と `csv2geojsonseq.py` がこの行を除きます。

### GeoParquet形式へ変換

```bash
python src/csv2geoparquet.py hypocenter_convert.csv hypocenter_convert.parquet --lon Longitude --lat Latitude
python src/csv2geoparquet.py shindo_convert.csv shindo_convert.parquet --lon 観測点経度 --lat 観測点緯度
```

`ogr2ogr` でも変換できますが、GDALのビルドによってはParquetドライバが含まれないため、GitHub Actionsではgeopandas版を使っています。

<details>
<summary>ogr2ogr を使う場合</summary>

```bash
ogr2ogr -f "Parquet" hypocenter_convert.parquet hypocenter_convert.csv -oo X_POSSIBLE_NAMES=Longitude -oo Y_POSSIBLE_NAMES=Latitude -s_srs EPSG:4326 -t_srs EPSG:4326
ogr2ogr -f "Parquet" shindo_convert.parquet shindo_convert.csv -oo X_POSSIBLE_NAMES=観測点経度 -oo Y_POSSIBLE_NAMES=観測点緯度 -s_srs EPSG:4326 -t_srs EPSG:4326
```
</details>

### PMTiles形式へ変換

行区切りGeoJSONを作り、[feltのtippecanoe](https://github.com/felt/tippecanoe)に通します。

```bash
python src/csv2geojsonseq.py hypocenter_convert.csv hypocenter_convert.geojsonl --lon Longitude --lat Latitude
python src/csv2geojsonseq.py shindo_convert.csv shindo_convert.geojsonl --lon 観測点経度 --lat 観測点緯度

tippecanoe -zg -o hypocenter_convert.pmtiles -r1 -pf -pk -l hypocenter_convert hypocenter_convert.geojsonl
tippecanoe -zg -B7 -rg -o shindo_convert.pmtiles -r1 -d8 -pf -pk -l shindo_convert shindo_convert.geojsonl
```

> [!IMPORTANT]
> - **地震IDを数値化しないこと**。ビューワが `['==', ['get','地震ID'], '19230901115831']` と文字列で比較します。`csv2geojsonseq.py` は既定で全列を文字列にし、`--number` を付けた列だけ数値にします。
> - **`-r1 -pf -pk` を外さないこと**。震源は点の密度そのものが情報です。`-ad` を使うと密なタイルで9割以上の地物が捨てられます。
> - `-l` でレイヤー名を明示すること。ビューワの `source-layer`（`hypocenter_convert` / `shindo_convert`）と一致させる必要があります。

## ビューワ（`viewer/`）

Vite + TypeScript + MapLibre GL JS 6 で構築しています。

- **最大震度3以上の15,480件**から震央地名・年月日・M・震度で検索できます（`熊本 M7`、`2011-3-11`、`震度6弱 大阪` のようにAND指定可）
- 地震ごとに「強く揺れた範囲」を索引に持たせ、選ぶとその範囲へカメラが寄ります
- クリックで観測点・震源の属性表示、ダークモード、背景地図の切替
- 地震の選択はパネルの外の常設バーに置いてあり、パネルを畳んでも切り替えられます

検索の索引は `src/build_event_index.py` が生成します。

```bash
python src/build_event_index.py hypocenter_convert.csv viewer/public/events.json --shindo-csv shindo_convert.csv
```

PMTilesの配置場所は `viewer/.env` の `VITE_PMTILES_BASE` で切り替えられます。震源・震度・人口集中地区の3つともこの1行で切り替わります。

## 自動化（GitHub Actions）

| ワークフロー | 起動 | 内容 |
|---|---|---|
| `check-jma-updates.yml` | 毎月1日 09:00 JST | 配信状況を `data/jma_manifest.json` と照合し、差分があればIssueに起票 |
| `run-pipeline.yml` | 手動 | DL→変換→GeoParquet→PMTiles。成果物をReleasesへ公開 |
| `deploy-pages.yml` | `viewer/**` の更新時 | ビューワをビルドしてGitHub Pagesへ公開 |

定期実行は**検知のみ**です。変換自体は気象庁側の仕様変更を確認してから手動で流す想定です。

## 実験: MLT（MapLibre Tile）形式

<details>
<summary>震源データで MLT を試した結果と手順</summary>

[MLT](https://maplibre.org/maplibre-tile-spec/) はMVTの後継として策定された形式で、カラム指向のレイアウトと型別の軽量エンコーディングでサイズを削減します。

```bash
bash src/build_mlt_tiles.sh work/hypocenter_convert.csv work/mlt
```

MLTへは**MVTを経由します**。参考実装のEncode CLIがMVTを入力に取るトランスコーダで、タイル自体は作れないためです。エンコーダは [maplibre-tile-spec](https://github.com/maplibre/maplibre-tile-spec) から自前でビルドします（Java 21以上。17では不可）。

```bash
git clone --depth=1 https://github.com/maplibre/maplibre-tile-spec.git ~/mlt-spec
cd ~/mlt-spec/java && chmod +x gradlew && ./gradlew cli
```

### 計測結果（震源214,639件・z0-8・495タイル・間引きなし）

| 形式 | サイズ | MVT非圧縮比 |
|---|---:|---:|
| MVT（非圧縮） | 159,481,388 B | 基準 |
| MLT（既定） | 105,892,279 B | 66.4%（33.6%削減） |
| MLT（`--enable-fastpfor --enable-fsst --sort-ids`） | 57,100,205 B | **35.8%（64.2%削減）** |
| MVT（gzip -9） | 40,109,812 B | 25.2% |

**軽量エンコーディングは既定でオフです。** `--enable-fastpfor`（整数列）と `--enable-fsst`（文字列列）を有効にすると削減率が倍近くになります。既定はMortonのみが有効な状態で、そのまま測るとMLTを過小評価します。

一方で、転送量だけならgzip圧縮したMVTのほうが小さいという結果でもあります。MLTの狙いは解凍とパースを経ずGPUバッファへ載せられることなので、サイズだけで採否を判断すべきではありません（デコード速度は未計測）。

`build_mlt_tiles.sh` は参考実装に合わせて既定設定で変換します。デコーダ側の実装が揃っていない環境で読めなくなることを避けるためです。

### 注意点

- 整数値と小数が混在する列はMVT内でINT/DOUBLEが混ざり、MLTエンコーダが型エラーで停止します。`csv2geojsonseq.py --float` で微小なオフセットを足して回避します
- **MLTの3D座標対応は仕様にはありますが、JS側は未実装です。** デコーダの `VertexBufferType.VEC_3` は参照0件、MapLibre GL JS のMLTアダプタは `new Point(coord.x, coord.y)` でz値を捨てます。深さを3D表示するなら、z値は属性で運んで描画側で組み立てる必要があります

</details>

## データ使用上の注意

データを使用するにあたり、下記を必ずご確認ください。

- [データフォーマット](https://www.data.jma.go.jp/svd/eqev/data/bulletin/data/shindo/format_j.pdf)（[リポジトリ内のコピー](document/format_j.pdf)）
- [気象庁の地震カタログの解説](https://www.data.jma.go.jp/svd/eqev/data/bulletin/data/hypo/relocate.html)

1996年10月の震度階級改定より前のデータには、震度5・6に強弱の区別がありません。

## ライセンス

本プログラムは[MITライセンス](LICENSE)で提供されます。

本データセットは CC BY 4.0 で提供されます。使用の際には本リポジトリへのリンクを提示してください。本データセットは、気象庁が公開している地震月報(カタログ編)の震度データ及び震度観測点一覧を加工して作成したものです。使用・加工にあたっては[気象庁の利用規約](https://www.jma.go.jp/jma/kishou/info/coment.html)を必ずご確認ください。

人口集中地区は[政府統計の総合窓口（e-Stat）](https://www.e-stat.go.jp/gis)、背景地図は国土地理院の最適化ベクトルタイル・全国最新写真を使用しています。

## 免責事項

利用者が当該データを用いて行う一切の行為について、何ら責任を負うものではありません。
