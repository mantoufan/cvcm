# cv.cm

Browser-local tools. Files never leave your device.

cv.cm 是一组在浏览器里运行的工具。图片和水印都在本地画布上处理，不会上传，也没有数据库。

## Tools

- **Image watermark** / 图片水印 — text or logo, batch export, ZIP. [Open](https://cv.cm/zh-CN/watermark/)

Languages: 简体中文, 繁體中文, English, 日本語, 한국어.

## Develop

```
npm install
npm test
npm run dev
```

Open http://localhost:5173/ — the client picks a language from the browser and sends you to `/{locale}/`.

## Deploy

Cloudflare Worker, static assets, no bindings.

```
npm run build
npm run deploy
```

Production: https://cv.cm
