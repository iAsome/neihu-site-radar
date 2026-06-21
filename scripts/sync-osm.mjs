import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const endpoint = "https://overpass-api.de/api/interpreter";
const query = `[out:json][timeout:180];
area["boundary"="administrative"]["name"="內湖區"]->.a;
(
  nwr["shop"](area.a);
  nwr["amenity"](area.a);
  nwr["office"](area.a);
  nwr["craft"](area.a);
  nwr["tourism"](area.a);
  nwr["leisure"~"fitness_centre|sports_centre|amusement_arcade|park"](area.a);
  nwr["public_transport"](area.a);
  nwr["railway"="station"](area.a);
);
out center tags;`;

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

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "User-Agent": "NeihuSiteRadar/1.0 (open-data research)" },
  body: new URLSearchParams({ data: query })
});
if (!response.ok) throw new Error(`Overpass ${response.status}: ${await response.text()}`);
const raw = await response.json();
const places = raw.elements.flatMap((e) => {
  const lat = e.lat ?? e.center?.lat;
  const lon = e.lon ?? e.center?.lon;
  if (!lat || !lon) return [];
  const [category, subcategory] = classify(e.tags);
  return [{
    id: `${e.type}/${e.id}`,
    name: e.tags?.name || e.tags?.brand || `未命名${category}`,
    brand: e.tags?.brand || null,
    category,
    subcategory,
    cuisine: e.tags?.cuisine || null,
    address: [e.tags?.["addr:street"], e.tags?.["addr:housenumber"]].filter(Boolean).join("") || null,
    openingHours: e.tags?.opening_hours || null,
    lat,
    lon,
    source: "OpenStreetMap",
    tags: e.tags || {}
  }];
});

await mkdir(`${root}/data`, { recursive: true });
await writeFile(`${root}/data/osm-raw.json`, JSON.stringify(raw));
await writeFile(`${root}/data/places.json`, JSON.stringify({
  generatedAt: new Date().toISOString(),
  attribution: "© OpenStreetMap contributors, ODbL 1.0",
  count: places.length,
  places
}, null, 2));
console.log(`已整理 ${places.length.toLocaleString()} 個內湖 POI`);
