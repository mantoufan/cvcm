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
- **Audio cutter** / 音频剪辑. [Open](https://cv.cm/en/audio-cutter/)
- **Audio joiner** / 音频拼接. [Open](https://cv.cm/en/audio-joiner/)
- **Text & data** / 文本与数据 — JSON, CSV, Base64, Markdown. [Open](https://cv.cm/en/data/)
- **QR code** / 二维码 — text or URL to PNG, on-device. [Open](https://cv.cm/en/qr/)
- **Barcode generator** / 条码生成 — Code 128, Code 39, EAN-13. [Open](https://cv.cm/en/barcode/)
- **Password generator** / 密码生成. [Open](https://cv.cm/en/password/)
- **Word counter** / 字数统计. [Open](https://cv.cm/en/word-count/)
- **Resize / compress** / 缩放压缩. [Open](https://cv.cm/en/resize/)
- **Crop** / 裁剪. [Open](https://cv.cm/en/crop/)
- **Rotate image** / 旋转图片. [Open](https://cv.cm/en/rotate/)
- **EXIF remover** / 清除照片信息. [Open](https://cv.cm/en/exif/)
- **Meme generator** / 表情包. [Open](https://cv.cm/en/meme/)
- **Signature generator** / 签名. [Open](https://cv.cm/en/signature/)
- **Favicon generator** / Favicon. [Open](https://cv.cm/en/favicon/)
- **Color picker** / 取色器. [Open](https://cv.cm/en/color/)
- **PDF to JPG** / PDF 转图片. [Open](https://cv.cm/en/pdf-jpg/)
- **Merge PDF** / 合并 PDF. [Open](https://cv.cm/en/merge-pdf/)
- **Compress PDF** / 压缩 PDF. [Open](https://cv.cm/en/compress-pdf/)
- **Split PDF** / 拆分 PDF. [Open](https://cv.cm/en/split-pdf/)
- **Invoice generator** / 发票 PDF. [Open](https://cv.cm/en/invoice/)
- **Name generator** / 名字与用户名. [Open](https://cv.cm/en/names/)
- **Time zone converter** / 时区转换. [Open](https://cv.cm/en/timezone/)
- **Timestamp converter** / 时间戳. [Open](https://cv.cm/en/timestamp/)
- **Lorem ipsum** / 占位文本. [Open](https://cv.cm/en/lorem/)
- **Unit converter** / 单位换算. [Open](https://cv.cm/en/units/)
- **Text to speech** / 文字转语音. [Open](https://cv.cm/en/text-to-speech/)
- **Diff checker** / 文本对比. [Open](https://cv.cm/en/diff/)
- **UUID generator** / UUID. [Open](https://cv.cm/en/uuid/)
- **Regex tester** / 正则测试. [Open](https://cv.cm/en/regex/)

## Lessons

Six featured tutorials: phone photography, window light, cropping, a complete portrait session, algorithm basics, and a one-page HTML project. Each edited tutorial explains a complete task with concise steps and instructional diagrams. Full editorial revisions are available in English, Simplified Chinese and Traditional Chinese.

- [All tutorials](https://cv.cm/en/learn/) / [全部教程](https://cv.cm/zh-cn/learn/)
- [Phone photography](https://cv.cm/en/learn/phone-photos/)
- [Window light](https://cv.cm/en/learn/window-light/)
- [Cropping](https://cv.cm/en/learn/crop-compose/)
- [Portrait session](https://cv.cm/en/learn/portrait/)
- [Algorithm basics](https://cv.cm/en/learn/algorithms/)
- [One-page site](https://cv.cm/en/learn/one-page-site/)

Older court, pool and interpersonal lesson URLs remain accessible for compatibility, but are no longer promoted on the home page or in tutorial navigation.

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
