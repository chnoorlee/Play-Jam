# 余信 / THE LAST POST

一款可直接游玩的原创 2.5D 叙事解谜 Demo。潮水即将淹没白沙邮局，邮差许渡带着三封迟到的信，在“此刻”与“回声”之间寻找收件人。投递的答案，未必等于告别的答案。

## 启动

从 GitHub 克隆的源码不包含构建产物，需要先安装 Node.js 22.12+ 并在项目目录运行：

```powershell
npm ci
npm run build
```

构建后，或使用已包含 `dist/` 的完整游戏包时，Windows 双击 `start.cmd`，浏览器会自动打开。游玩时保留启动窗口；关闭窗口即可停止本地服务。运行已构建的 `dist` 需要 Node.js 22.12+，不需要安装 npm 依赖。

也可以在本目录运行：

```powershell
node server.mjs
```

访问终端显示的本机地址，默认 `http://127.0.0.1:4173`。端口占用时会自动选择其他空闲端口。不要直接双击 `dist/index.html`，模块需要通过本地 HTTP 服务打开。

## 游玩

- 点击场景或地标自动行走；点击地标会走近并交互。触屏可直接点按。
- `WASD` / 方向键移动，`E` 与近处目标互动。
- `Q` 切换“此刻 / 回声”，`J` 查看线索簿，`Esc` 暂停或收起窗口。
- 右上角可开关音乐；默认静音。文字线索不依赖声音。
- 进度自动保存在当前浏览器、当前地址；换浏览器或端口不会共享存档。
- 三封信分别包含机关与人物选择，最后可进入三个不同结局。结局页可导出信笺并重选最后的决定。

首次游玩建议自行探索；需要演示时可参考 [含剧透流程](docs/WALKTHROUGH.zh-CN.md)。

## 比赛材料

- [作品与参赛说明](docs/SUBMISSION.zh-CN.md)
- [AI 工作流、真实案例、评审方法与商业化结论](docs/RESEARCH_AND_COMMERCIAL_REVIEW.zh-CN.md)
- [AI 与素材来源披露](docs/AI_AND_ASSET_DISCLOSURE.zh-CN.md)
- [验证记录与限制](docs/VERIFICATION.zh-CN.md)
- [第三方许可](THIRD_PARTY_NOTICES.md)

当前是可玩的参赛基础版本。海报中提到的正式主题尚未提供，团队资格、报名、准确截止日期与提交格式仍需根据主办方通知确认。未代为报名、发布商店产品或提交比赛。未进行真人乐趣测试或取得商业盈利证据。

## 开发

使用 Three.js 正交 3D 场景呈现 2.5D 视觉；PathFinding.js 提供 A* 寻路；Lucide 提供界面图标。程序化几何与 Web Audio 合成音频均随代码生成，运行时没有在线生成服务、外部字体或素材请求。

```powershell
npm ci
npm run build
npm test
npm run dev
```

开发服务器启动后，另开终端运行 `npm run test:e2e`。若 Playwright 尚未安装 Chromium，先运行 `npx playwright install chromium`。端到端测试默认访问 `http://127.0.0.1:5173`，可用环境变量 `GAME_URL` 指定开发地址。测试桥接只存在于开发构建，正式构建不暴露故事状态。

源码：`src/world.js` 场景与寻路；`src/story.js` 剧情与存档；`src/main.js` 交互；`src/audio.js` 合成声音；`src/style.css` 界面。修改后重新执行 `npm run build`，再用 `start.cmd` 运行新版本。
