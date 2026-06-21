import { writeFile, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = `${root}/data/regions`;
const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter"
];

const regions = [
  { id: "taipei", name: "臺北市", shortName: "台北", center: [121.5598, 25.0878], bbox: [121.45, 24.96, 121.67, 25.21] },
  { id: "new-taipei", name: "新北市", shortName: "新北", center: [121.4628, 25.0120], bbox: [121.28, 24.67, 122.02, 25.31] },
  { id: "keelung", name: "基隆市", shortName: "基隆", center: [121.7392, 25.1276], bbox: [121.63, 25.05, 121.82, 25.21] },
  { id: "taoyuan", name: "桃園市", shortName: "桃園", center: [121.3010, 24.9937], bbox: [120.98, 24.58, 121.48, 25.18] },
  { id: "hsinchu-city", name: "新竹市", shortName: "新竹市", center: [120.9686, 24.8066], bbox: [120.88, 24.72, 121.03, 24.87] },
  { id: "hsinchu-county", name: "新竹縣", shortName: "新竹縣", center: [121.1252, 24.8387], bbox: [120.97, 24.42, 121.53, 25.04] }
];

const classify = (t = {}) => {
  const shop = t.shop;
  const amenity = t.amenity;
  if (["restaurant", "fast_food", "food_court", "ice_cream"].includes(amenity)) return ["餐飲", amenity];
  if (["cafe", "bar", "pub", "biergarten"].includes(amenity) || ["beverages", "tea", "coffee"].includes(shop)) return ["飲料咖啡", amenity || shop];
  if (["clinic", "dentist", "doctors", "hospital", "pharmacy", "veterinary"].includes(amenity) || ["medical_supply", "optician"].includes(shop)) return ["醫療健康", amenity || shop];
  if (["convenience", "supermarket", "department_store", "mall", "general", "variety_store", "grocery"].includes(shop)) return ["便利零售", shop];
  if (["clothes", "shoes", "fashion", "jewelry", "bag", "beauty", "cosmetics", "hairdresser"].includes(shop)) return ["服飾美妝", shop];
  if (["mobile_phone", "electronics", "computer", "appliance"].includes(shop)) return ["3C通訊", shop];
  if (["fitness_centre", "sports_centre", "amusement_arcade"].includes(t.leisure) || ["cinema", "theatre", "nightclub", "arts_centre"].includes(amenity)) return ["運動娛樂", t.leisure || amenity];
  if (["school", "kindergarten", "college", "university", "library"].includes(amenity)) return ["教育學習", amenity];
  if (["bank", "atm", "post_office", "bureau_de_change"].includes(amenity)) return ["金融服務", amenity];
  if (["fuel", "parking", "car_wash", "charging_station"].includes(amenity) || ["car", "car_repair", "bicycle"].includes(shop)) return ["交通汽車", amenity || shop];
  if (t.office) return ["公司辦公", t.office];
  if (t.public_transport || t.railway) return ["交通節點", t.public_transport || t.railway];
  if (t.tourism || t.leisure === "park") return ["觀光休閒", t.tourism || t.leisure];
  if (shop) return ["其他零售", shop];
  if (amenity) return ["生活服務", amenity];
  return ["其他設施", t.craft || "other"];
};

const queryFor = region => {
  const scope = region.id === "hsinchu-county"
    ? `(${region.bbox[1]},${region.bbox[0]},${region.bbox[3]},${region.bbox[2]})`
    : "(area.a)";
  const area = region.id === "hsinchu-county" ? "" : `area["boundary"="administrative"]["name"="${region.name}"]->.a;`;
  return `[out:json][timeout:240];
${area}
(
  nwr["shop"]${scope};
  nwr["amenity"]${scope};
  nwr["office"]${scope};
  nwr["craft"]${scope};
  nwr["tourism"]${scope};
  nwr["leisure"~"fitness_centre|sports_centre|amusement_arcade|park"]${scope};
  nwr["public_transport"]${scope};
  nwr["railway"="station"]${scope};
);
out center tags;`;
};

async function fetchRegion(region) {
  let lastError;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "NorthernTaiwanSiteRadar/2.0 (open-data research)" },
        body: new URLSearchParams({ data: queryFor(region) }),
        signal: AbortSignal.timeout(300000)
      });
      if (!response.ok) throw new Error(`${endpoint} ${response.status}: ${await response.text()}`);
      return response.json();
    } catch (error) {
      lastError = error;
      console.warn(`${region.name} 來源失敗，改用備援：${error.message}`);
    }
  }
  throw lastError;
}

function compactPlaces(raw, region) {
  const seen = new Set();
  return raw.elements.flatMap(e => {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (!lat || !lon) return [];
    const id = `${e.type}/${e.id}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const [category, subcategory] = classify(e.tags);
    return [{
      id,
      r: region.id,
      n: e.tags?.name || e.tags?.brand || `未命名${category}`,
      b: e.tags?.brand || null,
      c: category,
      s: subcategory,
      u: e.tags?.cuisine || null,
      a: [e.tags?.["addr:street"], e.tags?.["addr:housenumber"]].filter(Boolean).join("") || null,
      h: e.tags?.opening_hours || null,
      y: Number(lat.toFixed(7)),
      x: Number(lon.toFixed(7))
    }];
  });
}

await mkdir(outDir, { recursive: true });
const generatedAt = new Date().toISOString();
const index = { generatedAt, attribution: "© OpenStreetMap contributors, ODbL 1.0", regions: [] };

for (const region of regions) {
  try {
    const cached = JSON.parse(await readFile(`${outDir}/${region.id}.json`, "utf8"));
    if (cached?.places?.length) {
      index.regions.push({ ...region, count: cached.places.length, file: `./data/regions/${region.id}.json` });
      console.log(`${region.name}：沿用 ${cached.places.length.toLocaleString()} 個既有點位`);
      continue;
    }
  } catch {}
  console.log(`開始下載 ${region.name}…`);
  const raw = await fetchRegion(region);
  const places = compactPlaces(raw, region);
  await writeFile(`${outDir}/${region.id}.json`, JSON.stringify({ generatedAt, region: region.name, count: places.length, places }));
  index.regions.push({ ...region, count: places.length, file: `./data/regions/${region.id}.json` });
  console.log(`${region.name}：${places.length.toLocaleString()} 個點位`);
  await new Promise(resolve => setTimeout(resolve, 1200));
}

index.totalCount = index.regions.reduce((sum, region) => sum + region.count, 0);
await writeFile(`${outDir}/index.json`, JSON.stringify(index, null, 2));
console.log(`完成：${index.totalCount.toLocaleString()} 個北台灣點位`);
