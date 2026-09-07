# cv.cm

Browser-local tools. Files never leave your device.

cv.cm 是一组在浏览器里运行的工具。图片和水印都在本地画布上处理，不会上传，也没有数据库。

## Tools

- **Image watermark** / 图片水印 — text or logo, batch export, ZIP. [Open](https://cv.cm/en/watermark/)
- **Photo collage** / 图片拼图 — combine photos with layouts. [Open](https://cv.cm/en/collage/)
- **PNG / JPG / WebP** — convert in the browser. [Open](https://cv.cm/en/convert/)
- **Images to PDF** / 图片转 PDF. [Open](https://cv.cm/en/image-pdf/)

Languages: English, 简体中文, 繁體中文, 日本語, 한국어, Tiếng Việt, Bahasa Indonesia, Español. The list starts with English; the page still follows the browser language.

## Develop

```
npm install
npm test
npm run dev
```

Open http://localhost:5173/ — the client picks a language from the browser and sends you to `/{locale}/`.

## Deploy

```
npm run build
npm run deploy
```

Production: https://cv.cm
