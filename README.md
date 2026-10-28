# 百木生的博客

使用 Hugo 和 Monochrome 搭建的简体中文个人博客。首页展示文章，另有归档、标签、关于页、站内搜索和 RSS。仓库内的三篇文章为可替换的示例内容。

# 一. 本地运行

## 1.1 准备环境

需要 Node.js 20 或更新版本，无需安装 npm 依赖。Hugo Extended 固定为 `.hugo-version` 中的版本，主题源码保存在 `themes/monochrome/`。

~~~sh
node scripts/setup.mjs
node scripts/hugo.mjs dev
~~~

首次运行 `setup` 会从 Hugo 官方 GitHub Release 下载对应系统的便携版，校验 SHA256 后放入项目的 `.tools/`，不修改全局环境。后续会复用同版本的本地程序。

预览地址为 [http://localhost:1313/](http://localhost:1313/)，包含草稿。按 Ctrl+C 停止。额外 Hugo 参数可以接在命令后，例如：

~~~sh
node scripts/hugo.mjs dev --port 1414
~~~

自动准备支持 Windows x64 与 Linux x64/arm64，分别使用 PowerShell 和系统 `tar` 解压。macOS 等其他系统请手动安装 `.hugo-version` 中指定的 Hugo Extended，跳过 `setup`，直接运行预览或构建命令。若官方 GitHub 下载暂不可用，可以自行安装与 `.hugo-version` 相同版本的 Hugo Extended；运行脚本在没有本地便携版时会查找 PATH 中的 `hugo`。

## 1.2 构建与检查

~~~sh
node scripts/hugo.mjs build
node scripts/check.mjs
~~~

构建结果位于 `dist/`。构建会清理该目录中的旧产物；不要在其中保存手写文件。完整性检查会核对主要页面、站内链接、图片和脚本文件，以及搜索索引、RSS 与站点地图。

`package.json` 也提供 `setup`、`dev`、`build`、`check` 四个同名脚本；有 npm 的环境可使用 `npm run build` 等命令。

# 二. 写文章与修改外观

## 2.1 内容位置

| 位置 | 用途 |
| --- | --- |
| `content/_index.md` | 首页内容与标题 |
| `content/posts/文章目录/index.md` | 文章正文与前置信息 |
| `content/posts/_index.md` | 归档页 |
| `content/about.md` | 关于页 |
| `static/user.css` | 中文字体、间距等自定义样式 |
| `i18n/zh-cn.toml` | 简体中文界面文字 |
| `layouts/` | 项目对主题的少量模板覆盖 |

文章和图片放在同一目录，便于一起移动或备份。示例：

~~~text
content/posts/my-first-note/
├── index.md
└── photo.jpg
~~~

创建文章：

~~~sh
node scripts/hugo.mjs new content posts/my-first-note/index.md
~~~

文章模板来自 `archetypes/posts.md`。根据生成的前置信息填写标题、日期、摘要和标签。正式发布时将 `draft` 改为 `false`；本地预览可查看草稿，正式构建会排除草稿。

现有 `first-post`、`markdown-guide`、`reading-notes` 三个目录均为示例，可在发布前替换或删除。`markdown-guide` 包含中文长文、表格、代码和本地图片，适合核对排版。

## 2.2 品牌与导航

主要配置位于 `hugo.toml`：

- `title`：浏览器标题与站点名称。
- `params.navbar_title`：导航栏中显示的昵称。
- `params.author.name`：作者名称。
- `params.description`：站点描述。
- `menus.navbar`：导航项。
- `baseURL`：正式托管地址，需保留结尾的斜杠。

首页标题还可在 `content/_index.md` 中修改。优先通过配置、`static/user.css` 和 `layouts/` 定制；主题原始源码及许可保留在 `themes/monochrome/`，上游来源与固定修订记录见 `THIRD_PARTY_NOTICES.md`。

# 三. 发布

## 3.1 GitHub Pages 自动发布

正式访问地址配置为 `https://baimusheng.github.io/`，对应仓库名称 `Baimusheng.github.io`。可将原有 `Blog` 仓库直接改名，无需新建项目或购买域名。

仓库已提供 `.github/workflows/pages.yml`。开通后，每次向 `main` 推送文章或代码都会构建、检查并发布，也可以在 Actions 页面手动运行。

首次开通步骤：

1. 将本地项目提交并推送到自己的 GitHub 仓库。
2. 在仓库 `Settings → Pages → Build and deployment` 中，将来源选择为 `GitHub Actions`。
3. 打开 `Actions`，运行“发布博客到 GitHub Pages”，或再向 `main` 推送一次。
4. 等待构建和部署成功，在 `Settings → Pages` 中查看实际站点地址。

工作流会使用 GitHub 返回的 `base_url` 覆盖构建地址，兼容 `https://用户名.github.io/仓库名/` 这样的子路径。源码中不需要写入令牌。是否可以从私有仓库发布取决于 GitHub 账户计划与仓库设置。

当前只提供并本地检查了工作流文件；这不表示 GitHub Pages 已开启，也不表示本地改动已经推送到 `origin`。

## 3.2 Sites 私密预览

`.openai/hosting.json` 用于记录 Sites 预览站点及静态目录配置。Sites 的预览权限与 GitHub Pages 独立；修改本地文件后，需要重新构建并通过 Sites 保存、发布对应版本，托管地址才会更新。

Sites 的站点标识应保留，不要为同一个预览重复创建站点。凭据由发布工具临时提供，不写入源码或配置。仅在需要公开访问时修改预览的访问权限。

## 3.3 其他静态托管

可以把 `dist/` 交给任何支持静态文件的托管服务。换域名或发布到子路径时，构建前指定实际地址：

PowerShell：

~~~powershell
$env:BLOG_BASE_URL = 'https://example.com/blog/'
node scripts/hugo.mjs build
node scripts/check.mjs
Remove-Item Env:BLOG_BASE_URL
~~~

macOS/Linux：

~~~sh
BLOG_BASE_URL='https://example.com/blog/' node scripts/hugo.mjs build
node scripts/check.mjs
~~~

`BLOG_BASE_URL` 只覆盖此次构建，不会改写 `hugo.toml`。发布前应以最终地址构建，避免 RSS、站点地图和资源链接仍指向预览地址。

# 四. 维护与已知事项

## 4.1 版本来源

- Hugo 版本只有一个来源：`.hugo-version`，当前为 `0.169.0`。
- Monochrome 源码作为固定副本随仓库保存，升级前应阅读其变更记录并重新构建验证。
- 本博客暂不单独发布软件版本，不额外维护网站版本号。

## 4.2 上游构建提醒

当前 Monochrome 样式仍使用 Hugo 的 LibSass 编译方式，Hugo 可能输出弃用提醒。它不影响当前固定版本的正常构建；升级 Hugo 或主题时需要重新确认兼容性，不应把这条提醒误写为检查失败。

本地可编辑源文件和构建产物分离：`.tools/`、`resources/`、`dist/` 等目录均不进入版本控制。请保留 Monochrome 上游许可。
