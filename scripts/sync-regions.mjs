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
  const shop = t.shop || "", amenity = t.amenity || "", cuisine = (t.cuisine || "").toLowerCase();
  const text = `${t.name || ""} ${t.brand || ""} ${cuisine}`;
  const hit = pattern => pattern.test(text);
  if (hit(/豆花|仙草|燒仙草|douhua|tofu.pudding/i)) return ["豆花仙草", cuisine || amenity || shop, "甜品烘焙"];
  if (amenity === "ice_cream" || hit(/剉冰|刨冰|雪花冰|冰店|冰品|冰果|甜湯|薏仁|ice.?cream|gelato/i)) return ["冰品甜湯", cuisine || amenity || shop, "甜品烘焙"];
  if (["confectionery","pastry","chocolate"].includes(shop) || hit(/甜品|甜點|蛋糕|糕點|甜荳|patisserie|dessert|cake/i)) return ["蛋糕甜點", cuisine || shop, "甜品烘焙"];
  if (shop === "bakery" || hit(/麵包|烘焙|bakery/i)) return ["麵包烘焙", cuisine || shop, "甜品烘焙"];
  if (["beverages","tea"].includes(shop) || /bubble_tea|tea/.test(cuisine) || hit(/手搖|茶飲|珍珠|果茶|五十嵐|50嵐|清心|迷客夏|可不可/i)) return ["手搖茶飲", cuisine || shop, "飲料咖啡"];
  if (amenity === "cafe" || shop === "coffee" || /coffee_shop|coffee/.test(cuisine) || hit(/咖啡|coffee|café|cafe/i)) return ["咖啡廳", cuisine || amenity || shop, "飲料咖啡"];
  if (hit(/果汁|juice|smoothie/i)) return ["果汁飲品", cuisine || shop, "飲料咖啡"];
  if (hit(/茶館|茶屋|tea.house/i)) return ["茶館", cuisine || amenity, "飲料咖啡"];
  if (["bar","pub","biergarten"].includes(amenity) || ["wine","alcohol"].includes(shop) || hit(/餐酒|酒館|酒食屋|酌屋|\bbar\b|金色三麥/i)) return ["酒吧餐酒館", cuisine || amenity || shop, "飲料咖啡"];
  if (/hot_pot/.test(cuisine) || hit(/火鍋|鍋物|涮涮鍋|麻辣鍋/i)) return ["火鍋", cuisine || amenity, "主食餐廳"];
  if (/barbecue/.test(cuisine) || hit(/燒肉|燒烤|串燒|烤肉/i)) return ["燒烤", cuisine || amenity, "主食餐廳"];
  if (/japanese|sushi|ramen|udon|soba/.test(cuisine) || hit(/日式|日本料理|壽司|拉麵|丼飯|居酒屋/i)) return ["日式料理", cuisine || amenity, "主食餐廳"];
  if (/korean/.test(cuisine) || hit(/韓式|韓國|韓膳|韓烤|韓食/i)) return ["韓式料理", cuisine || amenity, "主食餐廳"];
  if (/thai|vietnamese|indian|malaysian|indonesian|filipino/.test(cuisine) || hit(/泰式|越南|印度料理|馬來西亞|東南亞/i)) return ["東南亞料理", cuisine || amenity, "主食餐廳"];
  if (/italian|french|american|mexican|spanish|mediterranean|german|greek|pizza|pasta/.test(cuisine) || hit(/義式|法式|美式|德式|希臘|墨西哥|西班牙|地中海|披薩|比薩|義大利麵|\bpasta\b|\bpizza\b/i)) return ["歐美餐廳", cuisine || amenity, "主食餐廳"];
  if (/vegetarian|vegan/.test(cuisine) || hit(/素食|蔬食|純素|植物料理|vegan|vegetarian/i)) return ["素食餐廳", cuisine || amenity, "主食餐廳"];
  if (hit(/健康餐|餐盒|低卡|輕食|沙拉|健身餐/i)) return ["健康餐盒", cuisine || amenity, "主食餐廳"];
  if (/breakfast|brunch|sandwich/.test(cuisine) || hit(/早餐|早午餐|早安|早點|豆漿|蛋餅|飯糰|晨間|水煎包|燒餅|饅頭|三明治/i)) return ["早餐早午餐", cuisine || amenity, "快餐小吃"];
  if (/burger|fried_chicken|chicken/.test(cuisine) || hit(/漢堡|炸雞|鹽酥雞|雞排/i)) return ["漢堡炸物", cuisine || amenity, "快餐小吃"];
  if (/noodle|dumpling/.test(cuisine) || hit(/麵館|麵食|牛肉麵|乾拌麵|炸醬麵|擔仔麵|但仔麵|切仔麵|羹麵|水餃|鍋貼|餛飩/i)) return ["麵食水餃", cuisine || amenity, "快餐小吃"];
  if (hit(/便當|飯包|盒餐|自助餐|快餐|排骨飯|雞腿飯/i)) return ["便當自助餐", cuisine || amenity, "快餐小吃"];
  if (hit(/滷味|宵夜|鹹酥雞/i)) return ["宵夜滷味", cuisine || amenity, "快餐小吃"];
  if (/taiwanese/.test(cuisine) || hit(/小吃|蚵仔|肉圓|肉羹|魷魚羹|豬血湯|魚湯|粿仔湯|羊肉|土雞|潤餅|刈包|割包|胡椒餅|滷肉飯|魯肉飯|米粉|臭豆腐/i)) return ["台灣小吃", cuisine || amenity, "快餐小吃"];
  if (/chinese|cantonese|shanghai|hakka/.test(cuisine) || hit(/中式|川菜|粵菜|江浙|上海|客家|北平|港式|冰室|燒臘|烤鴨|熱炒|合菜/i)) return ["中式餐廳", cuisine || amenity, "主食餐廳"];
  if (shop === "convenience") return ["便利超商", shop, "食品零售"];
  if (shop === "supermarket") return ["超市量販", shop, "食品零售"];
  if (["greengrocer","seafood","butcher","cheese","farm","dairy"].includes(shop)) return ["食材生鮮", shop, "食品零售"];
  if (["deli","food","spices","pasta"].includes(shop)) return ["熟食食品", shop, "食品零售"];
  if (["restaurant","food_court"].includes(amenity)) return ["其他餐廳", cuisine || amenity, "主食餐廳"];
  if (amenity === "fast_food") return ["其他小吃快餐", cuisine || amenity, "快餐小吃"];
  return ["其他飲食", cuisine || amenity || shop, "其他飲食"];
};

const queryFor = region => {
  const scope = region.id === "hsinchu-county"
    ? `(${region.bbox[1]},${region.bbox[0]},${region.bbox[3]},${region.bbox[2]})`
    : "(area.a)";
  const area = region.id === "hsinchu-county" ? "" : `area["boundary"="administrative"]["name"="${region.name}"]->.a;`;
  return `[out:json][timeout:240];
${area}
(
  nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|biergarten)$"]${scope};
  nwr["shop"~"^(bakery|confectionery|beverages|tea|coffee|deli|supermarket|convenience|greengrocer|seafood|butcher|cheese|chocolate|pastry|farm|food|spices|wine|alcohol|pasta|dairy)$"]${scope};
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
    const [category, subcategory, group] = classify(e.tags);
    return [{
      id,
      r: region.id,
      n: e.tags?.name || e.tags?.brand || `未命名${category}`,
      b: e.tags?.brand || null,
      c: category,
      s: subcategory,
      g: group,
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
    const forceRegion = globalThis.SYNC_FORCE === true || (Array.isArray(globalThis.SYNC_FORCE) && globalThis.SYNC_FORCE.includes(region.id));
    if (!forceRegion && cached?.places?.length) {
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
