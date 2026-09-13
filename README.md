# cv.cm

Browser tools plus a tiny cloud clipboard.

图片工具在浏览器里运行，文件不上传。云剪切板把文字存进 Cloudflare D1，查看 10 次或超过 1 天自动删除，无需登录。

## Tools

- **Cloud clipboard** / 云剪切板 — text, images, video, files. Markdown / HTML / code. Gone after 10 views or 1 day. [Open](https://cv.cm/en/clip/)
- **Image watermark** / 图片水印 — text or logo, batch export, ZIP. [Open](https://cv.cm/en/watermark/)
- **Photo collage** / 图片拼图 — combine photos with layouts. [Open](https://cv.cm/en/collage/)
- **Image formats** / 图片格式 — PNG, JPG, WebP, AVIF, GIF, BMP, ICO. [Open](https://cv.cm/en/convert/)
- **Images to PDF** / 图片转 PDF. [Open](https://cv.cm/en/image-pdf/)
- **Audio to WAV** / 音频转 WAV. [Open](https://cv.cm/en/audio/)
- **Text & data** / 文本与数据 — JSON, CSV, Base64, Markdown. [Open](https://cv.cm/en/data/)
- **QR code** / 二维码 — text or URL to PNG, on-device. [Open](https://cv.cm/en/qr/)
- **Password generator** / 密码生成. [Open](https://cv.cm/en/password/)
- **Word counter** / 字数统计. [Open](https://cv.cm/en/word-count/)
- **Resize / compress** / 缩放压缩. [Open](https://cv.cm/en/resize/)
- **Crop** / 裁剪. [Open](https://cv.cm/en/crop/)
- **Color picker** / 取色器. [Open](https://cv.cm/en/color/)
- **PDF to JPG** / PDF 转图片. [Open](https://cv.cm/en/pdf-jpg/)
- **Merge PDF** / 合并 PDF. [Open](https://cv.cm/en/merge-pdf/)

Languages: English, 简体中文, 繁體中文, 日本語, 한국어, Tiếng Việt, Bahasa Indonesia, Español. The list starts with English; the page still follows the browser language.

## Develop

```
npm install
npm test
npm run dev
```

Open http://localhost:5173/ — the client picks a language from the browser and sends you to `/{locale}/`.

Clipboard API calls need the Worker + D1 (`npm run deploy` or `npx wrangler pages dev dist`).

## Deploy

```
npm run build
npx wrangler d1 migrations apply cvcm --remote
npm run deploy
```

Production: https://cv.cm
