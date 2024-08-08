# jma-earthquake-data-converter
## プログラムについて
- 本プログラムは、気象庁が公開している、[地震月報(カタログ編)の震度データ（1919～2020年）及び震度観測点一覧](https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html)を読みやすい形式（GISデータ）に変換するプログラムです。
- オープンソースソフトウェアで構築

## データの入手
- 以下の気象庁のサイトより地震月報(カタログ編)の震度データ（zip形式）や震度観測点一覧を入手します。
- https://www.data.jma.go.jp/eqev/data/bulletin/shindo.html
- なお、一括で震度データ（zip形式）をダウンロードするPythonスクリプトは以下にあります。
- https://github.com/shi-works/jma-earthquake-data-converter/blob/main/src/shindo_zip_dl.py

## 震度観測点一覧を読みやすい形式へ変換（code_p2csv.py）
- 震度観測点一覧（datファイル）を読みやすい形式（csvファイル）に変換するプログラムです。
### 使用データ
`https://github.com/shi-works/jma-earthquake-data-converter/blob/main/data/code_p.dat`
### 出力結果
`https://github.com/shi-works/jma-earthquake-data-converter/blob/main/data/code_p.csv`

## 震源データ及び震度データの抽出（dat_converter.py）
- 震度データ（datファイル）から震源データ（csvファイル）及び震度データ（csvファイル）を抽出するプログラムです。
- 震源データは１番上のレコードが代表値（採用値）となっており、本プログラムでは代表値（採用値）のみ出力します。
- 震源データの西暦、月、日、時、分、秒より地震IDを作成し、震源データ及び震度データそれぞれに付与しています。
### 使用データ
- 震度データ（datファイル）一式
### 出力結果
#### 震源データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter.csv`,28.7MB
#### 震度データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo.csv`,199.3MB

## 震源データを読みやすい形式へ変換（hypocenter_converter.py）
- 震源データ（csvファイル）を読みやすい形式（csvファイル）に変換するプログラムです。
- 震源データの西暦、月、日、時、分、秒よりDatTime及びUnixTimeを作成し、付与しています。
- 震源データの緯度(度)、緯度(分)、経度(度)、経度(分)よりLatitude、Longitudeを作成しています。
- 属性情報は必要最小限にしていますので適宜改変してください。
### 使用データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter.csv`,28.7MB
### 出力結果
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter_convert.csv`,19.6MB

## 震度データを読みやすい形式へ変換（shindo_converter.py）
- 震度データ（csvファイル）を読みやすい形式（csvファイル）に変換するプログラムです。
- 震度データは、観測点番号をキーにして、震度観測点一覧の震度発表名称、観測点緯度及び観測点経度を付与しています。
- 震度データの地震ID（年月）と発現日、発現時、発現分、発現秒よりDatTimeを作成し、付与しています。
- 属性情報は必要最小限にしていますので適宜改変してください。
### 使用データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo.csv`,199.3MB  
`https://github.com/shi-works/jma-earthquake-data-converter/blob/main/data/code_p.csv`
### 出力結果
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo_convert.csv`,180.2MB

## 震源データ及び震度データをGISデータ（FaltGeobuf形式及びGeoParquet形式）へ変換
- 震源データ及び震度データのGISデータ（FaltGeobuf形式及びGeoParquet形式）への変換には[QGIS（バージョン3.28.4）](https://qgis.org/ja/site/)を使用します。
### 使用データ
#### 震源データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter_convert.csv`,19.6MB
#### 震度データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo_convert.csv`,180.2MB
### 出力結果（FaltGeobuf形式及びGeoParquet形式）
#### 震源データ
##### FaltGeobuf形式
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter_convert.fgb`,51.6MB
##### GeoParquet形式
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter_convert.parquet`,8.5MB
#### 震度データ
##### FaltGeobuf形式
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo_convert.fgb`,453.8MB
##### GeoParquet形式
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo_convert.parquet`,29.8MB

## FaltGeobuf形式からPMTiles形式への変換
FaltGeobuf形式から[PMTiles形式](https://github.com/protomaps/PMTiles)への変換には[feltのtippecanoe](https://github.com/felt/tippecanoe)を使用します。
### 使用データ（FaltGeobuf形式）
#### 震源データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter_convert.fgb`,51.6MB
#### 震度データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo_convert.fgb`,453.8MB
### 出力結果（PMTiles形式）
#### 震源データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter_convert.pmtiles`,177.4MB
#### 震度データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo_convert.pmtiles`,541.7MB

### ベクトルタイル設計情報
- 震源データ及び震度データそのものを可能な限り生かしたデータです。
- tippecanoeによるデータの間引き（自動）は行っていません。

### ズームレベル範囲
- 0-14

### 属性
- 震源データ及び震度データの属性はそのまま生かしています。

### PMTiles Viewer
- PMTilesはPMTiles Viewerで閲覧することができます。
- https://protomaps.github.io/PMTiles/

## デモサイト
- MapLibre GL JSで構築
- https://shi-works.github.io/jma-earthquake-data-converter/
- サンプル画像
![image](https://github.com/shi-works/jma-earthquake-data-converter/assets/71203808/1c06cc86-f8a3-48ca-8971-1de10550a864)
### 使用データ
#### 震源データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/hypocenter_convert.pmtiles`,177.4MB
#### 震度データ
`https://xs489works.xsrv.jp/pmtiles-data/jma-earthquake/shindo_convert.pmtiles`,541.7MB
#### 人口集中地区（2020年）
`https://xs489works.xsrv.jp/pmtiles-data/r2DID/2020_did_ddsw_01-47_JGD2011.pmtiles`,12.7MB

## データ使用上の注意
- データを使用するにあたり、下記のデータフォーマットや気象庁の地震カタログの解説を必ずご確認ください。
- データフォーマット  
https://www.data.jma.go.jp/svd/eqev/data/bulletin/data/shindo/format_j.pdf
- 気象庁の地震カタログの解説  
https://www.data.jma.go.jp/svd/eqev/data/bulletin/data/hypo/relocate.html

## ライセンス
本プログラムは[MITライセンス](https://github.com/shi-works/jma-earthquake-data-converter/blob/main/LICENSE)で提供されます。  
本データセットはCC-BY-4.0で提供されます。使用の際には本レポジトリへのリンクを提示してください。

また、本データセットは、気象庁が公開している、地震月報(カタログ編)の震度データ及び震度観測点一覧を加工して作成したものです。本データセットの使用・加工にあたっては、[気象庁の利用規約](https://www.jma.go.jp/jma/kishou/info/coment.html)を必ずご確認ください。

## 免責事項
利用者が当該データを用いて行う一切の行為について何ら責任を負うものではありません。
