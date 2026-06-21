import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const indexPath = `${root}/data/regions/index.json`;
const index = JSON.parse(await readFile(indexPath, "utf8"));

function refine(place) {
  if (!place.c?.startsWith("其他")) return place;
  const text = `${place.n || ""} ${place.b || ""} ${place.s || ""} ${place.u || ""}`;
  const hit = pattern => pattern.test(text);
  const set = (c, g) => ({ ...place, c, g });

  if (hit(/豆花|仙草|燒仙草|douhua|tofu.pudding/i)) return set("豆花仙草", "甜品烘焙");
  if (hit(/剉冰|刨冰|雪花冰|冰店|冰品|冰果|甜湯|薏仁|ice.?cream|gelato/i)) return set("冰品甜湯", "甜品烘焙");
  if (hit(/甜品|甜點|蛋糕|糕點|甜荳|patisserie|dessert|cake/i)) return set("蛋糕甜點", "甜品烘焙");
  if (hit(/麵包|烘焙|bakery/i)) return set("麵包烘焙", "甜品烘焙");
  if (hit(/手搖|茶飲|珍珠|果茶|bubble.tea|五十嵐|50嵐|清心|迷客夏|可不可/i)) return set("手搖茶飲", "飲料咖啡");
  if (hit(/咖啡|coffee|café|cafe/i)) return set("咖啡廳", "飲料咖啡");
  if (hit(/果汁|juice|smoothie/i)) return set("果汁飲品", "飲料咖啡");
  if (hit(/茶館|茶屋|tea.house/i)) return set("茶館", "飲料咖啡");
  if (hit(/餐酒|酒館|酒食屋|酌屋|\bbar\b|金色三麥/i)) return set("酒吧餐酒館", "飲料咖啡");
  if (hit(/hot.pot|火鍋|鍋物|涮涮鍋|麻辣鍋/i)) return set("火鍋", "主食餐廳");
  if (hit(/barbecue|燒肉|燒烤|串燒|烤肉/i)) return set("燒烤", "主食餐廳");
  if (hit(/japanese|sushi|ramen|udon|soba|日式|日本料理|壽司|拉麵|丼飯|居酒屋/i)) return set("日式料理", "主食餐廳");
  if (hit(/korean|韓式|韓國|韓膳|韓烤|韓食/i)) return set("韓式料理", "主食餐廳");
  if (hit(/thai|vietnamese|indian|malaysian|indonesian|filipino|泰式|越南|印度料理|馬來西亞|東南亞/i)) return set("東南亞料理", "主食餐廳");
  if (hit(/italian|french|american|mexican|spanish|mediterranean|german|greek|pizza|pasta|義式|法式|美式|德式|希臘|墨西哥|西班牙|地中海|披薩|比薩|義大利麵/i)) return set("歐美餐廳", "主食餐廳");
  if (hit(/vegetarian|vegan|素食|蔬食|純素|植物料理/i)) return set("素食餐廳", "主食餐廳");
  if (hit(/健康餐|餐盒|低卡|輕食|沙拉|健身餐/i)) return set("健康餐盒", "主食餐廳");
  if (hit(/breakfast|brunch|sandwich|早餐|早午餐|早安|早點|豆漿|蛋餅|飯糰|晨間|水煎包|燒餅|饅頭|三明治/i)) return set("早餐早午餐", "快餐小吃");
  if (hit(/burger|fried.chicken|漢堡|炸雞|鹽酥雞|雞排/i)) return set("漢堡炸物", "快餐小吃");
  if (hit(/noodle|dumpling|麵館|麵食|牛肉麵|乾拌麵|炸醬麵|擔仔麵|但仔麵|切仔麵|羹麵|水餃|鍋貼|餛飩/i)) return set("麵食水餃", "快餐小吃");
  if (hit(/便當|飯包|盒餐|自助餐|快餐|排骨飯|雞腿飯/i)) return set("便當自助餐", "快餐小吃");
  if (hit(/滷味|宵夜|鹹酥雞/i)) return set("宵夜滷味", "快餐小吃");
  if (hit(/taiwanese|小吃|蚵仔|肉圓|肉羹|魷魚羹|豬血湯|魚湯|粿仔湯|羊肉|土雞|潤餅|刈包|割包|胡椒餅|滷肉飯|魯肉飯|米粉|臭豆腐/i)) return set("台灣小吃", "快餐小吃");
  if (hit(/chinese|cantonese|shanghai|hakka|中式|川菜|粵菜|江浙|上海|客家|北平|港式|冰室|燒臘|烤鴨|熱炒|合菜/i)) return set("中式餐廳", "主食餐廳");
  return place;
}

let changed = 0;
const before = {};
const after = {};
for (const region of index.regions) {
  const path = `${root}/data/regions/${region.id}.json`;
  const data = JSON.parse(await readFile(path, "utf8"));
  data.places = data.places.map(place => {
    before[place.c] = (before[place.c] || 0) + 1;
    const next = refine(place);
    if (next.c !== place.c) changed += 1;
    after[next.c] = (after[next.c] || 0) + 1;
    return next;
  });
  data.taxonomyUpdatedAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(data));
}

index.taxonomyUpdatedAt = new Date().toISOString();
await writeFile(indexPath, JSON.stringify(index, null, 2));
console.log(JSON.stringify({ changed, otherBefore: before["其他餐廳"], otherAfter: after["其他餐廳"], categories: after }, null, 2));
