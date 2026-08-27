#!/usr/bin/env bash
# 震源CSVから MLT（MapLibre Tile）タイルを作る。
#
#   bash src/build_mlt_tiles.sh work/hypocenter_convert.csv work/mlt
#
# MLTには MVT を経由する。参考実装の Encode CLI が MVT を入力に取るトランスコーダで、
# タイル自体は作れないため。
#
#   CSV → GeoJSONSeq（csv2geojsonseq.py）→ MVT（tippecanoe）→ MLT（encode.jar）
#
# 前提（WSL Ubuntu で確認）:
#   - Java 21以上   … encode.jar のビルドと実行に要る（17では不可）
#   - tippecanoe 2.x
#   - python3
#
# encode.jar は maplibre-tile-spec から自前でビルドする。
#   git clone --depth=1 https://github.com/maplibre/maplibre-tile-spec.git ~/mlt-spec
#   cd ~/mlt-spec/java && chmod +x gradlew && ./gradlew cli
#   → java/mlt-cli/build/libs/encode.jar
set -e

CSV=${1:?使い方: bash src/build_mlt_tiles.sh <hypocenter_convert.csv> <出力ディレクトリ>}
OUT=${2:?使い方: bash src/build_mlt_tiles.sh <hypocenter_convert.csv> <出力ディレクトリ>}
JAR=${MLT_ENCODE_JAR:-$HOME/mlt-spec/java/mlt-cli/build/libs/encode.jar}
MINZOOM=${MINZOOM:-0}
MAXZOOM=${MAXZOOM:-8}

[ -f "$JAR" ] || { echo "encode.jar が見つからない: $JAR" >&2; exit 1; }

mkdir -p "$OUT"
# tippecanoe はファイル名を source-layer 名にする（2.x の -l はGLOBALフラグのため使わない）
GEOJSON="$OUT/hypocenter.geojson"

echo "=== 1. CSV → GeoJSONSeq ==="
# 深さとマグニチュードは --float にする。整数値のまま出すとMVT内でINT/DOUBLEが
# 混在し、MLTエンコーダが型エラーで止まる。
python3 src/csv2geojsonseq.py "$CSV" "$GEOJSON" \
  --lon Longitude --lat Latitude \
  --float '深さ(km)' --float 'マグニチュード1'

echo "=== 2. GeoJSONSeq → MVT（tippecanoe）==="
# 震源は点の密度そのものが情報なので間引いてはいけない。READMEのPMTiles生成と同条件。
#   --no-tile-compression : MLTエンコーダが非圧縮PBFを要求する
#   -r1                   : 低ズームでの間引き率を1（＝間引かない）。既定2.5だと薄くなる
#   -pf                   : 1タイルあたりの地物数上限を外す
#   -pk                   : 1タイルあたりのサイズ上限（500KB）を外す
tippecanoe --no-tile-compression -Z"$MINZOOM" -z"$MAXZOOM" -r1 -pf -pk \
  -e "$OUT/mvt" "$GEOJSON" --force 2>&1 | tail -3

echo "=== 3. MVT → MLT（encode.jar）==="
# 参考実装（mlt-test/convert.sh）と同じ設定。--outlines 以外は既定のまま。
# FastPFOR/FSST は既定でオフ。有効化すると大きく縮むが（実測 66.4%→35.8%）、
# デコーダ側の実装が揃っていない環境で読めなくなる恐れがあるため参考実装に合わせる。
rm -rf "$OUT/tiles"
for pbf in $(find "$OUT/mvt" -name '*.pbf' | sort); do
  dir="$OUT/tiles/$(dirname "${pbf#"$OUT/mvt/"}")"
  mkdir -p "$dir"
  java -jar "$JAR" --mvt "$pbf" --dir "$dir" --outlines ALL >/dev/null 2>&1 || {
    echo "失敗: $pbf" >&2
    java -jar "$JAR" --mvt "$pbf" --dir "$dir" --outlines ALL 2>&1 | tail -3 >&2
    exit 1
  }
done

total() { find "$1" -name "$2" -printf '%s\n' | awk '{s+=$1} END {print s+0}'; }
mvt_b=$(total "$OUT/mvt" '*.pbf')
mlt_b=$(total "$OUT/tiles" '*.mlt')
echo
echo "タイル数: $(find "$OUT/tiles" -name '*.mlt' | wc -l)（z$MINZOOM-$MAXZOOM）"
printf 'MVT(非圧縮): %12d B\n' "$mvt_b"
printf 'MLT        : %12d B  %.1f%%（%.1f%%削減）\n' "$mlt_b" \
  "$(awk -v a="$mvt_b" -v b="$mlt_b" 'BEGIN{print b/a*100}')" \
  "$(awk -v a="$mvt_b" -v b="$mlt_b" 'BEGIN{print (1-b/a)*100}')"
echo "出力: $OUT/tiles"
