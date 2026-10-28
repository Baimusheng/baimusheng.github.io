import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const [command = "dev", ...extra] = process.argv.slice(2);

try {
  if (Number(process.versions.node.split(".")[0]) < 20) throw new Error("需要 Node.js 20 或更新版本。");
  if (!["dev", "build", "new"].includes(command)) {
    throw new Error("用法：node scripts/hugo.mjs <dev|build|new> [Hugo 参数]");
  }
  const version = readFileSync(path.join(root, ".hugo-version"), "utf8").trim();
  const local = path.join(root, ".tools", "hugo", process.platform === "win32" ? "hugo.exe" : "hugo");
  const binary = existsSync(local) ? local : "hugo";
  const info = spawnSync(binary, ["version"], { encoding: "utf8", windowsHide: true });
  if (info.error || info.status !== 0) throw new Error("未找到可用的 Hugo，请先执行 node scripts/setup.mjs。");
  if (!new RegExp("\\bv" + version.replaceAll(".", "\\.") + "(?:-[^\\s+]*)?\\+extended\\b").test(info.stdout)) {
    throw new Error("需要 Hugo Extended " + version + "，请执行 node scripts/setup.mjs。");
  }
  let args;
  if (command === "dev") {
    args = ["server", "--bind", "127.0.0.1", "--port", "1313", "--buildDrafts", ...extra];
  } else if (command === "build") {
    args = ["--destination", "dist", "--cleanDestinationDir", "--minify", "--gc"];
    if (process.env.BLOG_BASE_URL) {
      const baseURL = new URL(process.env.BLOG_BASE_URL);
      if (!["https:", "http:"].includes(baseURL.protocol)) throw new Error("BLOG_BASE_URL 必须是 http 或 https 地址。");
      if (!baseURL.pathname.endsWith("/")) baseURL.pathname += "/";
      args.push("--baseURL", baseURL.href);
    }
    args.push(...extra);
  } else {
    args = ["new", ...extra];
  }
  const result = spawnSync(binary, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, HUGO_ENVIRONMENT: command === "build" ? "production" : "development" },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error("运行失败：" + error.message);
  process.exitCode = 1;
}
