// 量一下手机视口下有没有横向溢出：用 CDP 读 document 的真实几何。
const port = process.argv[2] || '9224'

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

const expr = `(() => {
  const de = document.documentElement
  const bad = []
  for (const el of document.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.right > window.innerWidth + 0.5 || r.left < -0.5) {
      bad.push({ tag: el.tagName.toLowerCase(), cls: el.className || '', text: (el.textContent || '').trim().slice(0, 24),
                 left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) })
    }
  }
  return { innerWidth: window.innerWidth, scrollWidth: de.scrollWidth, bodyScroll: document.body.scrollWidth,
           overflowCount: bad.length, overflow: bad.slice(0, 8) }
})()`

const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
console.log(JSON.stringify(res.result?.result?.value ?? res, null, 2))
ws.close()
