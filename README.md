# 內湖開店雷達

輸入內湖店面地址或點擊地圖，以 50、100、200、500、1,000 公尺半徑分析周邊店家、品牌、客群、消費力、人流節奏、競爭與開店機會。

## 開啟網站

在 PowerShell 執行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start.ps1
```

再開啟 `http://127.0.0.1:4173/`。

## 目前資料

- 4,265 個內湖區 OSM 店家／設施／辦公／交通 POI，原始檔與整理檔都放在 `data/`。
- 臺北市政府 2026 年 5 月人口與戶數：內湖區 266,359 人、112,154 戶。
- 2026 年 5 月年齡分布，取自臺北市各里人口數按年齡分資料集。
- 消費力、人流、客群與店址分數為透明標示的模型推估，不宣稱是手機信令或門禁實測。

## 資料更新

`scripts/sync-osm.mjs` 會向 Overpass API 取得內湖區最新 OSM 點位並重建 `data/osm-raw.json` 與 `data/places.json`。需使用支援 `fetch` 的 Node.js 執行：

```powershell
npm run sync:osm
```

## 授權與限制

底圖與店家點位：© OpenStreetMap contributors，ODbL 1.0。政府資料依各資料集授權。本站沒有複製 Google Maps 內容。模型適合店址初篩；簽約前仍應完成現場分時段人流計數、可見度、租金與坪效調查。
