import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const target = `${root}/data/regions/hsinchu-county.json`;
const url = `https://nominatim.openstreetmap.org/search?format=geojson&polygon_geojson=1&limit=1&countrycodes=tw&q=${encodeURIComponent("新竹縣 臺灣")}`;
const boundary = globalThis.BOUNDARY_PATH
  ? JSON.parse((await readFile(globalThis.BOUNDARY_PATH, "utf8")).replace(/^\uFEFF/, ""))
  : await (await fetch(url, { headers: { "User-Agent": "NorthernTaiwanSiteRadar/2.0" } })).json();
const geometry = boundary.features?.[0]?.geometry;
if (!geometry) throw new Error("無法取得新竹縣界");

const inRing = ([x, y], ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const inPolygon = (point, polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some(hole => inRing(point, hole));
const contains = point => geometry.type === "Polygon"
  ? inPolygon(point, geometry.coordinates)
  : geometry.coordinates.some(polygon => inPolygon(point, polygon));

const data = JSON.parse(await readFile(target, "utf8"));
data.places = data.places.filter(place => contains([place.x, place.y]));
data.count = data.places.length;
data.trimmedToAdministrativeBoundary = true;
await writeFile(target, JSON.stringify(data));
console.log(`新竹縣界內保留 ${data.count.toLocaleString()} 個點位`);
