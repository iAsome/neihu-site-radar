import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
    const target = join(root, safe === "/" ? "index.html" : safe);
    const body = await readFile(target);
    res.writeHead(200, { "Content-Type": types[extname(target)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("找不到頁面");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`內湖開店雷達：http://127.0.0.1:${port}`);
});
