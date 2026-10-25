// 页面内查状态：node probe.mjs <port> '<js表达式>'
const port = process.argv[2] || '9224'
const expr = process.argv[3] || 'document.title'

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page' && t.url.includes('index.html'))
if (!page) { console.error('no page'); process.exit(1) }

const ws = new WebSocket(page.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params }))
})
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true })
console.log(JSON.stringify(r.result?.result?.value ?? r.result, null, 2))
ws.close()
