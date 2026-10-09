# 速记录音 · 一点即录人声增强

一个纯前端的录音小工具：点击麦克风即开始录音，实时人声增强（降噪、提亮、动态压缩），录完可本地播放与下载。所有处理在浏览器本地完成，不上传任何服务器，适合在手机 Safari / Chrome 上当「录音小插件」用。

## 功能

- **一点即录**：大圆形按钮，点一下开始，再点一下停止。
- **人声增强**：基于 Web Audio API 实时处理
  - 浏览器原生降噪 / 回声消除 / 自动增益（`getUserMedia` 约束）
  - 高通滤波去除低频隆隆声（默认 85 Hz，可调）
  - 3 kHz 峰值提升增加人声亮度（可调）
  - 动态压缩让音量更平稳
  - 增益放大整体音量
- **实时频谱**：录音时显示动态频谱条。
- **录音列表**：本地播放、下载、删除。
- **移动优先**：单栏布局，适配手机竖屏。

## 本地开发

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

指定端口：

```bash
PORT=43123 npm run dev
```

其它脚本：

```bash
npm run build   # 静态导出到 ./out
npm run start    # 运行生产构建（非静态）
npm run lint     # 代码检查
```

## 部署到 Cloudflare Pages

本项目已配置为静态导出（`output: "export"`），构建产物在 `./out`。

1. 注册 [Cloudflare](https://cloudflare.com)（免费）。
2. 进入 **Workers & Pages → Create application → Pages → Connect to Git**。
3. 授权并选择 GitHub 仓库 `hslling/voice-recorder`，分支 `main`。
4. 构建设置：
   - **Framework preset**: Next.js (Static HTML Export)
   - **Build command**: `npm run build`
   - **Build output directory**: `out`
   - **Node version**: 22（环境变量加 `NODE_VERSION=22`）
5. 点 **Save and Deploy**，几十秒后拿到 `*.pages.dev` 链接。
6. 如果 `*.pages.dev` 国内打不开，到 **Custom domains** 绑定你自己的域名（解析到 Cloudflare），可达性会明显提升。

## 部署到 Vercel（备选）

也支持，但默认 `*.vercel.app` 域名在国内多无法访问，需绑定自定义域名。

## 技术栈

- Next.js 15（App Router，静态导出）+ TypeScript
- Tailwind CSS v4
- shadcn/ui（base-ui）
- Web Audio API + MediaRecorder API

## 浏览器兼容

- iOS Safari 14+ / Android Chrome：支持录音与人声增强。
- 桌面 Chrome / Edge / Firefox：支持。
- 首次使用需授权麦克风权限；iOS Safari 需 HTTPS 或 localhost 才能访问麦克风。

## 说明

- 录音文件保存在浏览器内存中，刷新页面会丢失，请及时下载。
- 人声增强为实时轻度处理，不能替代专业降噪软件，主要面向会议、采访、随手备忘等场景。
