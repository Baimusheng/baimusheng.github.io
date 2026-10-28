import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
const failures = [];

function attributes(tag) {
  const values = {};
  for (const match of tag.matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/g)) {
    values[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return values;
}

function decode(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&#34;", '"').replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'").replaceAll("&apos;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">");
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(filename) : [filename];
  });
}

try {
  if (!existsSync(output)) throw new Error("未找到 dist/，请先执行 node scripts/hugo.mjs build。");
  const required = ["index.html", "posts/index.html", "tags/index.html", "about/index.html",
    "index.json", "index.xml", "sitemap.xml", "robots.txt"];
  for (const filename of required) {
    if (!existsSync(path.join(output, filename))) failures.push("缺少必要产物：" + filename);
  }
  if (failures.length) throw new Error(failures.join("\n"));

  const home = readFileSync(path.join(output, "index.html"), "utf8");
  const canonical = [...home.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => attributes(match[0])).find((item) => item.rel === "canonical")?.href;
  if (!canonical) throw new Error("首页缺少 canonical 地址，无法判断发布根路径。");
  const base = new URL(decode(canonical));
  if (!base.pathname.endsWith("/")) base.pathname += "/";

  let checkedLinks = 0;
  const inspectURL = (reference, source, currentURL = base) => {
    const value = decode(reference).trim();
    if (!value || value.startsWith("#") || /^(?:data|mailto|tel|javascript):/i.test(value)) return;
    let url;
    try { url = new URL(value, currentURL); }
    catch { failures.push(source + "：无法解析链接 " + value); return; }
    if (!["http:", "https:"].includes(url.protocol)) return;
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
        !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
      failures.push(source + "：产物残留本地预览地址 " + value);
      return;
    }
    if (url.origin !== base.origin) return;
    checkedLinks++;
    if (!url.pathname.startsWith(base.pathname)) {
      failures.push(source + "：链接超出发布子路径 " + url.pathname);
      return;
    }
    let relative;
    try { relative = decodeURIComponent(url.pathname.slice(base.pathname.length)); }
    catch { failures.push(source + "：链接编码无效 " + value); return; }
    const target = path.resolve(output, relative);
    const within = path.relative(output, target);
    if (within.startsWith("..") || path.isAbsolute(within)) {
      failures.push(source + "：链接指向构建目录之外 " + value);
      return;
    }
    const file = existsSync(target) && statSync(target).isDirectory() ? path.join(target, "index.html") : target;
    if (!existsSync(file) || !statSync(file).isFile()) failures.push(source + "：找不到 " + value);
  };

  const htmlFiles = walk(output).filter((filename) => filename.endsWith(".html"));
  for (const filename of htmlFiles) {
    const relative = path.relative(output, filename).split(path.sep).join("/");
    const route = relative.replace(/index\.html$/, "");
    const currentURL = new URL(route, base);
    const html = readFileSync(filename, "utf8");
    for (const match of html.matchAll(/<(?:a|link|script|img|source)\b[^>]*>/gi)) {
      const attrs = attributes(match[0]);
      if (attrs.href) inspectURL(attrs.href, relative, currentURL);
      if (attrs.src) inspectURL(attrs.src, relative, currentURL);
    }
  }

  const cards = [...home.matchAll(/<a\b[^>]*>\s*<div\b[^>]*class=(?:"postcard-item"|'postcard-item'|postcard-item)(?:\s|>)/gi)]
    .map((match) => attributes(match[0].slice(0, match[0].indexOf(">") + 1)).href);
  if (!cards.length) failures.push("首页没有文章卡片。");
  for (const href of cards) {
    const url = new URL(decode(href), base);
    if (!url.pathname.startsWith(base.pathname + "posts/")) failures.push("首页文章列表混入了非文章页面：" + url.pathname);
  }

  const index = JSON.parse(readFileSync(path.join(output, "index.json"), "utf8"));
  if (!Array.isArray(index) || !index.length) failures.push("搜索索引为空或不是数组。");
  else {
    for (const item of index) {
      if (typeof item.title !== "string" || typeof item.permalink !== "string" || typeof item.content !== "string") {
        failures.push("搜索索引中存在不完整的文章。");
      } else inspectURL(item.permalink, "index.json");
    }
  }

  const rss = readFileSync(path.join(output, "index.xml"), "utf8");
  if (!/<rss\b[\s\S]*<channel>[\s\S]*<\/channel>\s*<\/rss>\s*$/.test(rss)) failures.push("RSS 结构不完整。");
  for (const item of rss.matchAll(/<link>([^<]+)<\/link>/g)) inspectURL(item[1], "index.xml");

  const sitemap = readFileSync(path.join(output, "sitemap.xml"), "utf8");
  if (!/<urlset\b[\s\S]*<\/urlset>\s*$/.test(sitemap)) failures.push("站点地图结构不完整。");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)];
  if (!locations.length) failures.push("站点地图没有页面。");
  for (const item of locations) inspectURL(item[1], "sitemap.xml");

  if (failures.length) throw new Error([...new Set(failures)].join("\n"));
  console.log("检查通过：" + htmlFiles.length + " 个页面，" + checkedLinks + " 个站内引用；首页 " +
    cards.length + " 篇文章；搜索索引、RSS 和站点地图可读。");
} catch (error) {
  console.error("检查失败：\n" + error.message);
  process.exitCode = 1;
}
