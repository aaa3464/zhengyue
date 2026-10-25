// 按真实手机视口（模拟设备指标）截整页图，避免 Chrome 最小窗口宽度导致的裁切假象。
import { writeFileSync } from 'node:fs'

const port = process.argv[2] || '9224'
const out = process.argv[3] || 'shots/mobile.png'
const width = Number(process.argv[4] || 390)
const height = Number(process.argv[5] || 844)

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'))
if (!page) {
  console.error('没找到页面')
  process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
})
await new Promise((r) => ws.addEventListener('open', r))

function send(method, params = {}) {
  const msgId = ++id
  return new Promise((resolve) => {
    pending.set(msgId, resolve)
    ws.send(JSON.stringify({ id: msgId, method, params }))
  })
}

await send('Emulation.setDeviceMetricsOverride', {
  width, height, deviceScaleFactor: 2, mobile: true,
})
// 重新载入，确保拿到刚改过的文件（不是首屏缓存）
await send('Page.reload', { ignoreCache: true })
await new Promise((r) => setTimeout(r, 1200))

const geo = await send('Runtime.evaluate', {
  expression: `({ innerWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth,
                 pageH: document.body.scrollHeight })`,
  returnByValue: true,
})

const shot = await send('Page.captureScreenshot', {
  format: 'png', captureBeyondViewport: true, fromSurface: true,
})
writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
console.log(JSON.stringify({ ...geo.result.result.value, file: out }))
ws.close()
