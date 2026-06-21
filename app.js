const CATEGORY_META = {
  "餐飲": { color: "#e66f3d", ticket: 260 },
  "飲料咖啡": { color: "#b97a3e", ticket: 95 },
  "便利零售": { color: "#2a8b67", ticket: 180 },
  "醫療健康": { color: "#4677c8", ticket: 650 },
  "服飾美妝": { color: "#c05f8d", ticket: 980 },
  "3C通訊": { color: "#8668c8", ticket: 3200 },
  "運動娛樂": { color: "#d39132", ticket: 720 },
  "教育學習": { color: "#6e92b7", ticket: 380 },
  "金融服務": { color: "#516b88", ticket: 0 },
  "交通汽車": { color: "#66736c", ticket: 850 },
  "公司辦公": { color: "#176b4d", ticket: 0 },
  "交通節點": { color: "#1f918a", ticket: 0 },
  "觀光休閒": { color: "#78a847", ticket: 220 },
  "其他零售": { color: "#9a7461", ticket: 420 },
  "生活服務": { color: "#718078", ticket: 360 },
  "其他設施": { color: "#929b96", ticket: 0 }
};

const CUISINE_NAMES = {
  chinese: "中式", taiwanese: "台式", japanese: "日式", korean: "韓式", italian: "義式",
  american: "美式", burger: "漢堡", pizza: "披薩", noodle: "麵食", ramen: "拉麵",
  sushi: "壽司", hot_pot: "火鍋", vegetarian: "蔬食", coffee_shop: "咖啡", bubble_tea: "手搖飲",
  breakfast: "早餐", brunch: "早午餐", steak_house: "牛排", vietnamese: "越式", thai: "泰式",
  indian: "印度", bakery: "烘焙", seafood: "海鮮", chicken: "雞肉", barbecue: "燒烤"
};

const state = {
  center: { lat: 25.07857, lon: 121.57605 },
  address: "台北市內湖區瑞光路513巷22弄5號",
  radius: 500,
  places: [],
  nearby: [],
  stats: null,
  sources: [],
  filters: new Map(Object.keys(CATEGORY_META).map(k => [k, true])),
  map: null,
  radiusLayer: null,
  siteMarker: null,
  clusters: null,
  analysis: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const fmt = new Intl.NumberFormat("zh-TW");
const compact = new Intl.NumberFormat("zh-TW", { notation: "compact", maximumFractionDigits: 1 });
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const escapeHtml = (s = "") => String(s).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));

function distanceMeters(a, b) {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function groupCount(items, keyFn) {
  const out = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (key) out.set(key, (out.get(key) || 0) + 1);
  });
  return [...out.entries()].sort((a, b) => b[1] - a[1]);
}

function initMap() {
  state.map = L.map("map", { zoomControl: true, preferCanvas: true }).setView([state.center.lat, state.center.lon], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  }).addTo(state.map);

  state.clusters = L.markerClusterGroup({ maxClusterRadius: 42, showCoverageOnHover: false, disableClusteringAtZoom: 18 });
  state.map.addLayer(state.clusters);
  state.map.on("click", async e => {
    state.center = { lat: e.latlng.lat, lon: e.latlng.lng };
    state.address = `地圖選點 ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
    $("#address-input").value = state.address;
    await updateAnalysis({ fit: false });
  });
}

function updateMapLayers({ fit = true } = {}) {
  if (state.radiusLayer) state.map.removeLayer(state.radiusLayer);
  if (state.siteMarker) state.map.removeLayer(state.siteMarker);
  state.radiusLayer = L.circle([state.center.lat, state.center.lon], {
    radius: state.radius,
    color: "#176b4d",
    weight: 2,
    opacity: .85,
    fillColor: "#4ba879",
    fillOpacity: .09,
    dashArray: "6 5"
  }).addTo(state.map);
  state.siteMarker = L.marker([state.center.lat, state.center.lon], {
    icon: L.divIcon({ className: "", html: '<div class="site-marker"></div>', iconSize: [34, 34], iconAnchor: [17, 17] }),
    zIndexOffset: 1000
  }).addTo(state.map).bindPopup(`<strong>分析店址</strong><br>${escapeHtml(state.address)}`);

  state.clusters.clearLayers();
  const display = state.places.filter(p => state.filters.get(p.category) && distanceMeters(state.center, p) <= Math.max(1300, state.radius * 1.25));
  display.forEach(p => {
    const meta = CATEGORY_META[p.category] || CATEGORY_META["其他設施"];
    const icon = L.divIcon({ className: "", html: `<div class="poi-marker" style="background:${meta.color}"><i></i></div>`, iconSize: [16, 16], iconAnchor: [8, 15] });
    const marker = L.marker([p.lat, p.lon], { icon });
    marker.bindPopup(`<strong>${escapeHtml(p.name)}</strong><br><span class="popup-category">${escapeHtml(p.category)}</span>${p.cuisine ? `<br><small>口味：${escapeHtml(p.cuisine)}</small>` : ""}${p.address ? `<br><small>${escapeHtml(p.address)}</small>` : ""}`);
    state.clusters.addLayer(marker);
  });
  if (fit) state.map.fitBounds(state.radiusLayer.getBounds(), { padding: [44, 44], maxZoom: 18 });
}

function analyze() {
  const nearby = state.places.filter(p => distanceMeters(state.center, p) <= state.radius);
  state.nearby = nearby;
  const counts = Object.fromEntries(groupCount(nearby, p => p.category));
  const total = nearby.length;
  const areaHa = Math.PI * state.radius ** 2 / 10000;
  const uniqueBrands = new Set(nearby.map(p => p.brand).filter(Boolean));
  const named = nearby.filter(p => !p.name.startsWith("未命名"));
  const diversity = Object.keys(counts).length / Object.keys(CATEGORY_META).length;
  const office = counts["公司辦公"] || 0;
  const transit = counts["交通節點"] || 0;
  const restaurants = counts["餐飲"] || 0;
  const drinks = counts["飲料咖啡"] || 0;
  const convenience = counts["便利零售"] || 0;
  const medical = counts["醫療健康"] || 0;
  const leisure = (counts["運動娛樂"] || 0) + (counts["觀光休閒"] || 0);
  const education = counts["教育學習"] || 0;
  const density = total / Math.max(areaHa, .01);
  const officeIntensity = clamp(office / Math.max(areaHa, 1), 0, 8);
  const spendIndex = Math.round(clamp(94 + officeIntensity * 3 + medical * .24 + uniqueBrands.size * .17 + transit * 1.5, 82, 142));
  const lunchFlow = Math.round(clamp(office * 19 + restaurants * 11 + drinks * 6 + transit * 150 + convenience * 8 + education * 13, 90, 24500));
  const weekendRatio = clamp(.45 + (leisure + convenience + medical) / Math.max(20, office + restaurants) * .35, .35, 1.05);
  const demand = Math.round(clamp(42 + Math.log1p(density) * 10 + officeIntensity * 2.5, 30, 96));
  const access = Math.round(clamp(45 + transit * 7 + convenience * .8 + Math.min(state.radius / 80, 9), 35, 96));
  const complement = Math.round(clamp(48 + diversity * 48 + Math.min(convenience + medical + education, 18), 35, 95));
  const spending = Math.round(clamp((spendIndex - 75) * 1.35, 35, 95));
  const competition = Math.round(clamp(90 - (restaurants + drinks) / Math.max(total, 1) * 95 + diversity * 15, 35, 93));
  const resilience = Math.round(clamp(42 + weekendRatio * 40 + leisure * 1.1, 35, 93));
  const score = Math.round(demand * .24 + access * .17 + complement * .14 + spending * .18 + competition * .12 + resilience * .15);
  const confidence = Math.round(clamp(58 + Math.log1p(total) * 5 + named.length / Math.max(total, 1) * 12, 58, 92));
  return { counts, total, areaHa, uniqueBrands, named, density, office, transit, restaurants, drinks, convenience, medical, leisure, education, diversity, spendIndex, lunchFlow, weekendRatio, score, confidence, components: { demand, access, complement, spending, competition, resilience } };
}

function renderCategoryFilters() {
  const totals = Object.fromEntries(groupCount(state.places, p => p.category));
  const visible = Object.entries(CATEGORY_META).filter(([name]) => totals[name]).sort((a, b) => (totals[b[0]] || 0) - (totals[a[0]] || 0));
  $("#category-filters").innerHTML = visible.map(([name, meta]) => `
    <button class="filter-chip ${state.filters.get(name) ? "" : "off"}" data-category="${name}" style="--chip:${meta.color}">
      <span class="swatch"></span><span>${name}</span><span class="filter-count">${fmt.format(totals[name] || 0)}</span>
    </button>`).join("");
}

function renderCategoryBars(a) {
  const entries = Object.entries(a.counts).sort((x, y) => y[1] - x[1]).slice(0, 6);
  const max = entries[0]?.[1] || 1;
  $("#category-bars").innerHTML = entries.length ? entries.map(([name, count]) => `
    <div class="bar-row"><span>${name}</span><div class="bar-track"><div class="bar-fill" style="--width:${count / max * 100}%;--bar:${CATEGORY_META[name]?.color || "#718078"}"></div></div><b>${count}</b></div>`).join("") : `<p class="method-note" style="margin:0">此半徑尚無已收錄點位，請放大範圍。</p>`;
}

function opportunityModel(a) {
  const per100 = name => (a.counts[name] || 0) / Math.max(a.total, 1) * 100;
  const candidates = [
    { name: "健康快速午餐", score: 88 + a.office * .18 - per100("餐飲") * 1.7, why: "辦公需求高、重視速度與可預期品質" },
    { name: "精品咖啡／會議外送", score: 78 + a.office * .2 - per100("飲料咖啡") * 2.1, why: "商務會議與下午提神場景可疊加" },
    { name: "晚間社區型餐飲", score: 64 + a.convenience * .8 + a.medical * .5 - a.office * .08, why: "補足商辦區晚間流量下滑" },
    { name: "運動恢復／輕健身", score: 61 + a.office * .12 - a.leisure * 2.5, why: "下班時段與久坐族需求互補" },
    { name: "親子生活服務", score: 54 + a.education * 1.7 + a.convenience - a.office * .04, why: "住宅與學校密度帶動固定回訪" }
  ];
  return candidates.map(x => ({ ...x, score: Math.round(clamp(x.score, 38, 96)) })).sort((x, y) => y.score - x.score).slice(0, 3);
}

function renderOpportunities(a) {
  $("#opportunity-list").innerHTML = opportunityModel(a).map((x, i) => `
    <div class="opportunity"><span class="opportunity-rank">0${i + 1}</span><div><strong>${x.name}</strong><span>${x.why}</span></div><span class="opportunity-score">${x.score}</span></div>`).join("");
}

function renderCategoryTable(a) {
  const entries = Object.entries(a.counts).sort((x, y) => y[1] - x[1]).slice(0, 12);
  $("#category-table").innerHTML = entries.map(([name, count]) => {
    const density = count / Math.max(a.areaHa, .1);
    const level = density > 2.2 ? ["高", "high"] : density > .8 ? ["中", "medium"] : ["低", "low"];
    const ticket = CATEGORY_META[name]?.ticket || 0;
    return `<div class="table-row"><span class="cat-name">${name}</span><b>${count}</b><span>${ticket ? `$${fmt.format(ticket)}` : "—"}</span><span class="comp-level ${level[1]}">${level[0]}</span></div>`;
  }).join("") || `<div class="table-row"><span>無已收錄店家</span></div>`;
}

function renderCuisine(a) {
  const cuisines = groupCount(state.nearby.flatMap(p => (p.cuisine || "").split(/[;,]/).filter(Boolean).map(c => ({ c: c.trim() }))), x => x.c);
  $("#cuisine-tags").innerHTML = cuisines.length ? cuisines.slice(0, 14).map(([name, count]) => `<span>${CUISINE_NAMES[name] || name}<b>${count}</b></span>`).join("") : `<span>未標註口味</span>`;
}

function ageProfile(a) {
  const base = state.stats.ageBands.map(x => ({ ...x }));
  const officeBoost = clamp(a.office / Math.max(a.total, 1) * 1.8, 0, .5);
  const educationBoost = clamp(a.education / Math.max(a.total, 1), 0, .18);
  const factors = [1 + educationBoost, .78 + educationBoost, 1 + officeBoost, 1.18 + officeBoost, 1.06 + officeBoost * .5, .88, .78 + a.medical / Math.max(a.total, 1)];
  const adjusted = base.map((x, i) => ({ label: x.label, value: x.value * factors[i] }));
  const sum = adjusted.reduce((s, x) => s + x.value, 0);
  return adjusted.map(x => ({ label: x.label, pct: x.value / sum * 100 }));
}

function renderPeople(a) {
  const officeLed = a.office > a.convenience + a.education;
  const residential = a.convenience + a.medical + a.education > a.office * .7;
  const title = officeLed ? "效率型科技上班族" : residential ? "穩定回訪的家庭住戶" : "通勤與生活混合客群";
  const copy = officeLed
    ? "重視出餐速度、可預期品質與行動支付；午餐決策半徑短，平日下午有咖啡與飲品需求。"
    : residential ? "重視便利、信任與固定回訪；晚餐、醫療與日常採買比午間單一尖峰更穩定。"
      : "平日通勤需求與在地生活消費並存，可用早餐、午餐與晚間服務分散單一時段風險。";
  $("#persona-title").textContent = title;
  $("#persona-copy").textContent = copy;
  $("#persona-chips").innerHTML = (officeLed ? ["25–44 歲核心", "重視效率", "行動支付", "外送接受度高"] : ["家庭採買", "熟客關係", "晚間需求", "週末仍有流量"]).map(x => `<span>${x}</span>`).join("");

  const ages = ageProfile(a);
  const max = Math.max(...ages.map(x => x.pct));
  $("#age-chart").innerHTML = ages.map(x => `<div class="age-bar" style="--height:${x.pct / max * 100}%"><i></i><b>${x.pct.toFixed(0)}%</b><span>${x.label}</span></div>`).join("");
}

function flowProfile(a) {
  const officeFactor = clamp(a.office / Math.max(a.areaHa, 1), 0, 10);
  const residentFactor = clamp((a.convenience + a.medical + a.education) / Math.max(a.areaHa, 1), 0, 9);
  const lunch = a.lunchFlow;
  const raw = [
    .12 + residentFactor * .008, .18, .48 + officeFactor * .025, .72 + officeFactor * .02,
    .46, .58, 1, .78, .53, .49, .62 + officeFactor * .015, .83 + officeFactor * .015,
    .71, .49 + residentFactor * .018, .35 + residentFactor * .02, .2
  ];
  return raw.map((v, i) => ({ hour: i + 6, value: Math.round(lunch * clamp(v, .12, 1.08)) }));
}

function renderFlow(a) {
  const flow = flowProfile(a);
  const max = Math.max(...flow.map(x => x.value));
  $("#flow-chart").innerHTML = flow.map(x => `<div class="flow-column ${x.value > max * .82 ? "peak" : ""}" style="--height:${x.value / max * 100}%"><i></i>${x.hour % 2 === 0 ? `<span>${x.hour}</span>` : ""}</div>`).join("");
  const morning = flow.find(x => x.hour === 8).value;
  const lunch = flow.find(x => x.hour === 12).value;
  const evening = flow.find(x => x.hour === 18).value;
  $("#flow-events").innerHTML = [
    ["08:00", "通勤進場", a.transit ? "捷運／公車節點帶動" : "主要道路與辦公進場", morning],
    ["12:00", "午餐尖峰", "外出用餐決策集中", lunch],
    ["18:00", "下班移動", "外帶、運動與轉乘需求", evening]
  ].map(x => `<div class="flow-event"><time>${x[0]}</time><div><strong>${x[1]}</strong><span>${x[2]}</span></div><b>${compact.format(x[3])}</b></div>`).join("");
  const weekend = Math.round(a.weekendRatio * 100);
  $("#day-compare").innerHTML = `
    <div class="day-row"><span>平日</span><div class="day-track"><div class="day-fill" style="--width:100%"></div></div><b>100</b></div>
    <div class="day-row weekend"><span>假日</span><div class="day-track"><div class="day-fill" style="--width:${weekend}%"></div></div><b>${weekend}</b></div>`;
}

function renderAdvice(a) {
  const labels = { demand: "需求密度", access: "交通可達", complement: "業態互補", spending: "消費能力", competition: "競爭餘裕", resilience: "時段韌性" };
  $("#score-breakdown").innerHTML = Object.entries(a.components).map(([key, value]) => `
    <div class="score-line ${value < 55 ? "low" : ""}"><span>${labels[key]}</span><div class="line-track"><i style="--width:${value}%"></i></div><b>${value}</b></div>`).join("");
  const top = opportunityModel(a)[0];
  const items = [
    ["good", "+", `優先測試「${top.name}」`, `${top.why}；建議先用快閃或外送熱區驗證。`],
    [a.weekendRatio < .62 ? "warn" : "good", a.weekendRatio < .62 ? "!" : "+", a.weekendRatio < .62 ? "控制週末固定成本" : "週間流量較均衡", a.weekendRatio < .62 ? "商辦型商圈假日落差較大，排班與營業時間要能縮放。" : "生活服務與休閒設施可降低只靠平日午餐的風險。"],
    [a.restaurants > a.total * .26 ? "warn" : "good", a.restaurants > a.total * .26 ? "!" : "+", a.restaurants > a.total * .26 ? "餐飲競爭偏高" : "仍有品類切入空間", a.restaurants > a.total * .26 ? "避免做無差異便當；用速度、口味或訂閱制拉開差異。" : "店家密度尚未過度飽和，可用明確情境定位切入。"],
    ["good", "✓", "簽約前做 3 日現場計數", "至少觀察週二、週五與週六的 08:00、12:00、18:00，每次 30 分鐘。"]
  ];
  $("#advice-list").innerHTML = items.map(x => `<div class="advice-item ${x[0]}"><span class="advice-icon">${x[1]}</span><div><strong>${x[2]}</strong><p>${x[3]}</p></div></div>`).join("");
}

function renderSummary(a) {
  $("#selected-address").textContent = state.address;
  $("#site-score").textContent = a.score;
  $("#score-ring").style.setProperty("--score", a.score);
  $("#confidence-score").textContent = `${a.confidence}%`;
  $("#poi-count").textContent = fmt.format(a.total);
  $("#poi-density").textContent = `${a.density.toFixed(1)} 家／公頃`;
  $("#brand-count").textContent = fmt.format(a.uniqueBrands.size);
  $("#brand-ratio").textContent = `連鎖辨識率 ${Math.round(a.uniqueBrands.size / Math.max(a.total, 1) * 100)}%`;
  $("#spend-index").textContent = a.spendIndex;
  $("#lunch-flow").textContent = compact.format(a.lunchFlow);
  const good = a.score >= 72;
  $("#verdict").classList.toggle("caution", !good);
  $("#verdict").innerHTML = `<span class="verdict-icon">${good ? "↗" : "!"}</span><div><strong>${good ? "值得進一步評估" : "條件式可行"}</strong><p>${a.office > a.convenience ? "午間剛需強，晚間與假日需靠目的型消費補足。" : "生活型需求較穩定，仍需核對租金與街邊可見度。"}</p></div>`;
}

function renderAll(a) {
  state.analysis = a;
  renderSummary(a);
  renderCategoryBars(a);
  renderOpportunities(a);
  renderCategoryTable(a);
  renderCuisine(a);
  renderPeople(a);
  renderFlow(a);
  renderAdvice(a);
  renderCategoryFilters();
}

async function updateAnalysis(options = {}) {
  const analysis = analyze();
  renderAll(analysis);
  updateMapLayers(options);
  $("#walk-time").textContent = `${Math.max(1, Math.round(state.radius / 80))} 分鐘`;
}

async function geocodeAddress(address) {
  const normalized = (address.includes("台北") || address.includes("臺北") ? address : `臺北市內湖區 ${address}`).replace(/^台北/, "臺北");
  const lookup = async q => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=tw&accept-language=zh-TW&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("地址服務暫時無法使用");
    return res.json();
  };
  let data = await lookup(normalized);
  let approximate = false;
  if (!data.length) {
    const streetFallback = normalized.replace(/\d+弄.*$/, "").replace(/\d+號.*$/, "");
    if (streetFallback !== normalized) {
      await new Promise(resolve => setTimeout(resolve, 1050));
      data = await lookup(streetFallback);
      approximate = true;
    }
  }
  if (!data.length) throw new Error("找不到這個地址，請改用附近路名或直接點地圖");
  const lat = Number(data[0].lat);
  const lon = Number(data[0].lon);
  if (lat < 25.03 || lat > 25.14 || lon < 121.53 || lon > 121.66) throw new Error("目前版本僅分析臺北市內湖區範圍");
  if (approximate) toast("門牌未收錄，已定位至最接近的巷道路段");
  return { lat, lon, label: data[0].display_name, approximate };
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
}

function renderSources() {
  $("#sources-list").innerHTML = state.sources.map(s => `<div class="source-row"><div><strong>${s.name}</strong><p>${s.owner} · ${s.frequency} · 用於${s.usage}</p><a href="${s.url}" target="_blank" rel="noopener">開啟原始資料 ↗</a></div><span class="source-badge ${s.kind === "官方統計" ? "official" : s.kind === "實際觀測" ? "observed" : "model"}">${s.kind}</span></div>`).join("");
}

function bindEvents() {
  $("#address-form").addEventListener("submit", async e => {
    e.preventDefault();
    const address = $("#address-input").value.trim();
    if (!address) return;
    const button = e.currentTarget.querySelector("button");
    button.textContent = "…";
    try {
      const result = await geocodeAddress(address);
      state.center = { lat: result.lat, lon: result.lon };
      state.address = address;
      await updateAnalysis();
      toast("已完成地址周邊分析");
    } catch (err) { toast(err.message); }
    finally { button.textContent = "→"; }
  });

  $(".quick-addresses").addEventListener("click", e => {
    const btn = e.target.closest("button[data-lat]");
    if (!btn) return;
    state.center = { lat: Number(btn.dataset.lat), lon: Number(btn.dataset.lon) };
    state.address = btn.dataset.address;
    $("#address-input").value = state.address;
    updateAnalysis();
  });

  $(".radius-options").addEventListener("click", e => {
    const btn = e.target.closest("button[data-radius]");
    if (!btn) return;
    state.radius = Number(btn.dataset.radius);
    $$(".radius-options button").forEach(x => { x.classList.toggle("active", x === btn); x.setAttribute("aria-checked", x === btn ? "true" : "false"); });
    updateAnalysis();
  });

  $("#category-filters").addEventListener("click", e => {
    const btn = e.target.closest("button[data-category]");
    if (!btn) return;
    state.filters.set(btn.dataset.category, !state.filters.get(btn.dataset.category));
    renderCategoryFilters();
    updateMapLayers({ fit: false });
  });

  $("#toggle-all").addEventListener("click", e => {
    const anyOn = [...state.filters.values()].some(Boolean);
    state.filters.forEach((_, key) => state.filters.set(key, !anyOn));
    e.currentTarget.textContent = anyOn ? "全部顯示" : "全部隱藏";
    renderCategoryFilters();
    updateMapLayers({ fit: false });
  });

  $(".tabs").addEventListener("click", e => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    $$(".tabs button").forEach(x => x.classList.toggle("active", x === btn));
    $$(".tab-panel").forEach(x => x.classList.toggle("active", x.id === `tab-${btn.dataset.tab}`));
  });

  $("#reset-view").addEventListener("click", () => state.map.fitBounds(state.radiusLayer.getBounds(), { padding: [44, 44], maxZoom: 18 }));
  $("#locate-button").addEventListener("click", () => {
    if (!navigator.geolocation) return toast("此瀏覽器不支援定位");
    navigator.geolocation.getCurrentPosition(pos => {
      state.center = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      state.address = "目前位置";
      $("#address-input").value = state.address;
      updateAnalysis();
    }, () => toast("無法取得目前位置，請改用地址或地圖選點"));
  });

  const sourcesDialog = $("#sources-dialog");
  const helpDialog = $("#help-dialog");
  $("#open-sources").addEventListener("click", () => sourcesDialog.showModal());
  $("#help-button").addEventListener("click", () => helpDialog.showModal());
  $$('dialog .dialog-close').forEach(btn => btn.addEventListener("click", () => btn.closest("dialog").close()));
  $$('dialog').forEach(dialog => dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); }));

  $("#export-button").addEventListener("click", () => {
    const a = state.analysis;
    const report = {
      product: "內湖開店雷達",
      generatedAt: new Date().toISOString(),
      address: state.address,
      coordinates: state.center,
      radiusMeters: state.radius,
      score: a.score,
      confidence: a.confidence,
      nearbyBusinesses: a.total,
      brandCount: a.uniqueBrands.size,
      spendingIndex: a.spendIndex,
      estimatedLunchFlow: a.lunchFlow,
      categories: a.counts,
      opportunities: opportunityModel(a),
      disclaimer: "模型初篩，不構成營收或投資保證；簽約前請完成現場計數與租金坪效試算。"
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `內湖開店雷達-${state.radius}m-分析.json`; link.click();
    URL.revokeObjectURL(url);
    toast("分析摘要已匯出");
  });
}

async function boot() {
  initMap();
  try {
    const [placeData, stats, sources] = await Promise.all([
      fetch("./data/places.json").then(r => r.json()),
      fetch("./data/neihu-stats.json").then(r => r.json()),
      fetch("./data/sources.json").then(r => r.json())
    ]);
    state.places = placeData.places;
    state.stats = stats;
    state.sources = sources;
    $("#data-status").textContent = `${fmt.format(placeData.count)} 個內湖開放點位 · 更新 ${new Date(placeData.generatedAt).toLocaleDateString("zh-TW")}`;
    $("#district-pop").textContent = compact.format(stats.population);
    $("#district-households").textContent = compact.format(stats.households);
    $("#district-workforce").textContent = compact.format(stats.workforceEstimate.value);
    renderSources();
    bindEvents();
    await updateAnalysis();
  } catch (error) {
    console.error(error);
    $("#data-status").textContent = "資料載入失敗";
    toast("資料載入失敗，請確認網站以本機伺服器開啟");
  }
}

boot();
