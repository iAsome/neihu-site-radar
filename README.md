# 北台灣開店雷達

輸入台北、新北、基隆、桃園、新竹店面地址或點擊地圖，以 50、100、200、500、1,000 公尺半徑分析周邊店家、品牌、客群、消費力、人流節奏、競爭與開店機會。

## 開啟網站

在 PowerShell 執行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\start.ps1
```

再開啟 `http://127.0.0.1:4173/`。

## 目前資料（2026-06-21）

- 145,605 個北台灣 OSM 店家／設施／辦公／交通 POI，拆成台北、新北、基隆、桃園、新竹市與新竹縣六個分區檔。
- 分區第一次進入時載入並留在記憶體快取；縮放只由 WebGL 重新繪製，不重新下載店家資料。
- MapLibre GL JS 5.24.0 搭配 OpenFreeMap Liberty 向量底圖，使用 GPU 點位聚合與連續縮放動畫。
- 臺北市政府 2026 年 5 月人口與戶數：內湖區 266,359 人、112,154 戶。
- 2026 年 5 月年齡分布，取自臺北市各里人口數按年齡分資料集。
- 消費力、人流、客群與店址分數為透明標示的模型推估，不宣稱是手機信令或門禁實測。

## 資料更新

`scripts/sync-regions.mjs` 會向 Overpass API 取得六個區域的最新 OSM 點位，建立 `data/regions/*.json` 與索引。需使用支援 `fetch` 的 Node.js 執行：

```powershell
npm run sync:osm
```

## 授權與限制

底圖與店家點位：© OpenStreetMap contributors，ODbL 1.0。政府資料依各資料集授權。本站沒有複製 Google Maps 內容。模型適合店址初篩；簽約前仍應完成現場分時段人流計數、可見度、租金與坪效調查。
