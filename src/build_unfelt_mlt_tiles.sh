#!/usr/bin/env bash
# 震源カタログCSVから「震源（無感含む）」のMLTタイルを作る。ビューワが読んでいるものと同じ。
#
#   bash src/build_unfelt_mlt_tiles.sh work/hypocenter_catalog.csv work/mlt-unfelt
#
# 有感（src/build_mlt_tiles.sh）と分けてある。件数が桁違いで tippecanoe の設定が
# 別物になるため。無感は494万点あり、間引かないと低ズームで1タイルが数百MBになる。
# エンコードもタイルごとにJVMを起こしていられないので mbtiles で一括変換する。
#
#   CSV → GeoJSONSeq → MVT(mbtiles) → MLT(mbtiles) → XYZ
#
# 前提は build_mlt_tiles.sh と同じ（Java 21以上・tippecanoe 2.x・python3・encode.jar）。
set -e

CSV=${1:?使い方: bash src/build_unfelt_mlt_tiles.sh <hypocenter_catalog.csv> <出力ディレクトリ>}
OUT=${2:?使い方: bash src/build_unfelt_mlt_tiles.sh <hypocenter_catalog.csv> <出力ディレクトリ>}
JAR=${MLT_ENCODE_JAR:-$HOME/mlt-spec/java/mlt-cli/build/libs/encode.jar}
MINZOOM=${MINZOOM:-0}
MAXZOOM=${MAXZOOM:-10}

[ -f "$JAR" ] || { echo "encode.jar が見つからない: $JAR" >&2; exit 1; }

mkdir -p "$OUT"
# ファイル名が source-layer 名になる。ビューワの sourceLayer: 'unfelt' に合わせる
GEOJSON="$OUT/unfelt.geojson"
MBTILES="$OUT/unfelt.mbtiles"

echo "=== 1. CSV → GeoJSONSeq（無感のみ・5列）==="
# 最大震度が空の行が無感地震。
# 属性はビューワのポップアップが使う5つに絞る。全13列を載せるとタイルが太るうえ、
# 無感の行では最大震度・観測点数・震源決定フラグに見せるものがない。
# 深さとマグニチュードは --float にする。整数値のまま出すとMVT内でINT/DOUBLEが
# 混在し、MLTエンコーダが型エラーで止まる。
python3 src/csv2geojsonseq.py "$CSV" "$GEOJSON" \
  --lon Longitude --lat Latitude \
  --where-empty 最大震度 \
  --keep 地震ID --keep DateTime --keep 震央地名 \
  --keep '深さ(km)' --keep 'マグニチュード1' \
  --float '深さ(km)' --float 'マグニチュード1' \
  --rename '深さ(km)=深さ' --rename 'マグニチュード1=マグニチュード'

echo "=== 2. GeoJSONSeq → MVT（tippecanoe）==="
# --drop-densest-as-needed : 低ズームは間引く。有感と違い、間引かないと1タイルが数百MBになる
#                            最大ズーム10では全点が入る
# --no-tile-compression    : MLTエンコーダが非圧縮PBFを要求する
tippecanoe --no-tile-compression -Z"$MINZOOM" -z"$MAXZOOM" -l unfelt \
  --drop-densest-as-needed -o "$MBTILES" "$GEOJSON" --force 2>&1 | tail -3

echo "=== 3. MVT → MLT（encode.jar）==="
# タイルごとに起動するとJVMの立ち上げが17,833回になり数時間かかる。--mbtiles で一括変換する
rm -rf "$OUT/mlt" "$OUT/tiles"
mkdir -p "$OUT/mlt"
java -jar "$JAR" --mbtiles "$MBTILES" --dir "$OUT/mlt"

echo "=== 4. MLT(mbtiles) → XYZ ==="
# MapLibreはHTTP越しにmbtilesを読めないためファイルに開く
python3 src/explode_mbtiles.py "$OUT/mlt/unfelt.mlt.mbtiles" -o "$OUT/tiles" --ext mlt

total() { find "$1" -name "$2" -printf '%s\n' | awk '{s+=$1} END {print s+0}'; }
echo
echo "タイル数: $(find "$OUT/tiles" -name '*.mlt' | wc -l)（z$MINZOOM-$MAXZOOM）"
printf 'MLT: %12d B\n' "$(total "$OUT/tiles" '*.mlt')"
echo "出力: $OUT/tiles"
