import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));

try {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    throw new Error("需要 Node.js 20 或更新版本。");
  }
  const version = (await readFile(path.join(root, ".hugo-version"), "utf8")).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(".hugo-version 必须是 Hugo 的三段版本号。");
  const systems = { win32: "windows", linux: "linux" };
  const architectures = { x64: "amd64", arm64: "arm64" };
  const system = systems[process.platform];
  const architecture = architectures[process.arch];
  if (!system || !architecture || (process.platform === "win32" && process.arch !== "x64")) {
    throw new Error("自动准备仅支持 Windows x64 与 Linux x64/arm64。其他系统请手动安装 Hugo Extended " + version + "，再使用运行脚本。");
  }
  const destination = path.join(root, ".tools", "hugo");
  const executable = path.join(destination, process.platform === "win32" ? "hugo.exe" : "hugo");
  const isExpectedVersion = (binary) => {
    const result = spawnSync(binary, ["version"], { encoding: "utf8", windowsHide: true });
    return result.status === 0 &&
      new RegExp("\\bv" + version.replaceAll(".", "\\.") + "(?:-[^\\s+]*)?\\+extended\\b").test(result.stdout);
  };
  if (existsSync(executable) && isExpectedVersion(executable)) {
    console.log("Hugo Extended " + version + " 已就绪：" + executable);
  } else {
    const archiveName = "hugo_extended_" + version + "_" + system + "-" + architecture +
      (process.platform === "win32" ? ".zip" : ".tar.gz");
    const releaseURL = "https://github.com/gohugoio/hugo/releases/download/v" + version + "/";
    const download = async (name) => {
      const response = await fetch(releaseURL + name, {
        headers: { "User-Agent": "Blog-Hugo-Setup" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) throw new Error("下载 " + name + " 失败（HTTP " + response.status + "）。");
      return Buffer.from(await response.arrayBuffer());
    };
    const cache = path.join(root, ".tools", "downloads");
    await mkdir(cache, { recursive: true });
    const archivePath = path.join(cache, archiveName);
    console.log("准备 Hugo Extended " + version + "（" + system + "/" + architecture + "）…");
    const checksums = (await download("hugo_" + version + "_checksums.txt")).toString("utf8");
    const checksumLine = checksums.split(/\r?\n/).find((line) => {
      const match = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
      return match && match[2] === archiveName;
    });
    if (!checksumLine) throw new Error("官方校验文件中未找到 " + archiveName + "。");
    const expected = checksumLine.trim().match(/^([a-f0-9]{64})/i)[1].toLowerCase();
    let archive = existsSync(archivePath) ? await readFile(archivePath) : null;
    const checksum = (buffer) => createHash("sha256").update(buffer).digest("hex");
    if (!archive || checksum(archive) !== expected) archive = await download(archiveName);
    if (checksum(archive) !== expected) throw new Error("Hugo 下载文件的 SHA256 校验失败，未解压或运行该文件。");
    await writeFile(archivePath, archive);
    const temporary = await mkdtemp(path.join(cache, "extract-"));
    try {
      let extraction;
      if (process.platform === "win32") {
        const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
        extraction = spawnSync("powershell.exe", [
          "-NoProfile", "-NonInteractive", "-Command",
          "Expand-Archive -LiteralPath " + quote(archivePath) +
          " -DestinationPath " + quote(temporary) + " -Force",
        ], { stdio: "inherit", windowsHide: true });
      } else {
        extraction = spawnSync("tar", ["-xzf", archivePath, "-C", temporary], { stdio: "inherit" });
      }
      if (extraction.error || extraction.status !== 0) throw new Error("解压 Hugo 失败，请确认 PowerShell 或 tar 可用。");
      await mkdir(destination, { recursive: true });
      for (const entry of await readdir(temporary, { withFileTypes: true })) {
        if (entry.isFile()) await copyFile(path.join(temporary, entry.name), path.join(destination, entry.name));
      }
      if (process.platform !== "win32") await chmod(executable, 0o755);
      if (!isExpectedVersion(executable)) throw new Error("解压后的程序不是所需的 Hugo Extended " + version + "。");
    } finally {
      // 只清理本脚本刚创建、且位于项目下载缓存内的临时目录。
      const relative = path.relative(cache, temporary);
      if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
        await rm(temporary, { recursive: true, force: true });
      }
    }
    console.log("Hugo Extended " + version + " 已安装到 " + destination);
  }
} catch (error) {
  console.error("准备失败：" + error.message);
  process.exitCode = 1;
}
