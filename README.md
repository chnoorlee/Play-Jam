# 余信 / THE LAST POST

原创 2.5D 叙事解谜 Demo。潮水即将淹没白沙邮局，邮差许渡在“此刻”与“回声”之间投递三封迟到的信，再决定记忆的去向。

[直接在线游玩](https://chnoorlee.github.io/Play-Jam/)：打开网页即可开始，无需安装。

![《余信》封面原画，海港尽头亮着灯的白沙邮局](src/art/harbor-cover.webp)

## 运行

需要 Node.js 22.12+、npm 和支持 WebGL 的现代浏览器。克隆源码后运行：

```sh
git clone https://github.com/chnoorlee/Play-Jam.git
cd Play-Jam
npm ci
npm run build
node server.mjs
```

打开终端显示的地址，默认 `http://127.0.0.1:4173`。Windows 构建后也可双击 `start.cmd`。`dist/` 为本地构建产物，不纳入 Git；不要直接双击 HTML 文件。

点击港湾地图的地面或地标自动行走。进入白沙邮局、钟楼、玻璃温室和旧站台后，点击人物交谈，点击场景中的物件调查，或选“返回港湾”继续赶路。地图支持 WASD / 方向键移动与 E 互动，Q 切换时间，J 打开手记。支持触屏点按、自动存档和三个结局。运行时不调用在线大模型或外部素材服务。

## 开发与验证

```sh
npm test
npm run dev
```

开发服务器启动后，可在另一终端运行 `npx playwright install chromium` 和 `npm run test:e2e`。已保存的自动化验证记录见 [验证说明](docs/VERIFICATION.zh-CN.md)；真实设备帧率与真人体验仍待验证，建议开启浏览器硬件加速。

端到端测试默认连接 `http://127.0.0.1:5173`。若开发服务使用其他端口，可在 PowerShell 中先设置 `$env:GAME_URL = 'http://127.0.0.1:5181'`，再运行 `npm run test:e2e`。

## 本轮升级

白沙邮局、钟楼、玻璃温室和旧站台现在各有独立的可探索画面。序章在邮差许渡和沈伯之间切换镜头。之后可在四处地点分别与沈伯、曹遥、叶青和阿岚交谈，对话会随时态或投递进度变化。旧站台的两半邮戳分别藏在站牌和回声里的长椅下。

封面、四张地点背景和五名角色的原画由 ChatGPT 网页版按本作剧情生成。场景中的人物使用透明立绘，对话头像从同一批原画裁切。港湾地图由 Three.js 实时绘制。构建直接读取仓库里的 WebP，素材来源及旧版绘图脚本的用途见 [AI 与素材披露](docs/AI_AND_ASSET_DISCLOSURE.zh-CN.md)。

本轮加入钟楼铜环联动、温室连续光路、站台邮戳重组，配套三层按需提示、人物回执与纪念物；新增镜头放大、画质、音量、大号文字、减弱动态、JSON 存档备份恢复，以及结局 PNG 明信片导出。

验证流程覆盖四个场景、三个结局、设置保存、备份恢复及 PNG 下载。具体结果见 [验证记录](docs/VERIFICATION.zh-CN.md)。线上版本以对应提交的 [GitHub Actions 部署结果](https://github.com/chnoorlee/Play-Jam/actions/workflows/deploy.yml) 与在线检查为准。存档保存在当前浏览器，JSON 文件可用于备份和迁移投递进度，显示与声音设置单独保存在浏览器。

当前是进一步接近商业体验的 Demo，仍需真实玩家盲测和内容体量扩充；自动化通过不是商业化通过证明。改动前问题、证据边界与玩家测试方案见 [本轮商业评审与改进记录](docs/COMMERCIAL_REVIEW.md)。

## 自动部署

网站由 GitHub Pages 托管。每次将更新提交并推送到 `main`，GitHub Actions 会自动安装依赖、构建、运行单元测试及正式构建的浏览器冒烟测试，通过后更新同一个游玩地址。发布失败时，线上保留上次成功版本。

[查看部署状态或手动重新发布](https://github.com/chnoorlee/Play-Jam/actions/workflows/deploy.yml)。工作流见 [deploy.yml](.github/workflows/deploy.yml)，不需要额外的托管密钥。构建产物包含项目及第三方许可证。玩家刷新网页即可加载已发布的新版；存档保存在当前浏览器中。

## 文档与许可

- [完整中文使用说明](README.zh-CN.md)
- [参赛交接说明](docs/SUBMISSION.zh-CN.md)
- [AI 工作流、案例、评审与商业化研究](docs/RESEARCH_AND_COMMERCIAL_REVIEW.zh-CN.md)
- [本轮商业评审、改进证据与玩家测试计划](docs/COMMERCIAL_REVIEW.md)
- [AI 与素材来源披露](docs/AI_AND_ASSET_DISCLOSURE.zh-CN.md)
- [含剧透通关流程](docs/WALKTHROUGH.zh-CN.md)
- [MIT 许可证](LICENSE)与[第三方许可](THIRD_PARTY_NOTICES.md)

剧情、程序化场景、声音、代码及测试由 Codex AI 辅助制作，具体范围见披露文档。当前是参赛基础 Demo；正式比赛主题尚未提供，未代为报名或提交比赛，未取得专家评审、真人试玩或商业盈利证据。
