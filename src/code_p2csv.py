def convert_degrees(degrees_minutes):
    degrees, minutes = int(degrees_minutes[:-2]), int(degrees_minutes[-2:])
    return round(degrees + minutes / 60, 4)


def convert_txt_to_csv(input_file, output_file):
    with open(input_file, 'r', encoding='shift_jis') as file:
        data = file.read()

    lines = data.split("\n")
    rows = [line.split("\t") for line in lines]

    with open(output_file, 'w', encoding='shift_jis') as file:
        file.write("観測点番号,震度発表名称,観測点緯度,観測点経度,観測開始年月日時分,観測終了年月日時分\n")

        for row in rows:
            if len(row) < 6:  # 不適切な行をスキップ
                continue

            csv_row = [
                row[0],
                row[1],
                str(convert_degrees(row[2])),
                str(convert_degrees(row[3])),
                row[4],
                row[5]
            ]
            file.write(','.join(csv_row) + '\n')


# ここでテキストファイルの名前とCSVファイルの名前を指定してください。
input_file = 'code_p.dat'
output_file = 'code_p.csv'

convert_txt_to_csv(input_file, output_file)
