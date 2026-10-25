// 杩炴棤澶?Edge 璺戝钩琛¤嚜娴嬶細node sim.mjs [灞€鏁癩
import { spawn } from "node:child_process";

const PORT = 9231;
const N = +(process.argv[2] || 400);
const FILE = "file:///" + encodeURI("D:/DSH/娓告垙璁捐/闀囩害/demo/index.html");
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const edge = spawn(EDGE, [
    "--headless=new", `--remote-debugging-port=${PORT}`,
    "--user-data-dir=D:\\DSH\\娓告垙璁捐\\闀囩害\\demo\\.edge", "--disable-gpu", "--no-first-run",
    "about:blank"
  ], { stdio: "ignore", detached: false });
  let list = null;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (list.length) break; } catch (e) {}
  }
  const page = list.find(t => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });

  const errors = [];
  ws.addEventListener("message", ev => {
    const m = JSON.parse(ev.data);
    if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      errors.push((d.exception && d.exception.description || d.text || "").split("\n").slice(0, 4).join(" | "));
    }
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push(m.params.args.map(a => a.value || a.description || "").join(" "));
    }
  });
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: FILE + "?selftest=1&n=" + N });
  let out = null;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const r = await send("Runtime.evaluate", { expression: "window.__result || null", returnByValue: true });
    if (r.result && r.result.result && r.result.result.value) { out = r.result.value; break; }
  }
  console.log(JSON.stringify(out || { error: "no result", errors }, null, 1));
  const dbg = await send("Runtime.evaluate", { expression: "JSON.stringify({url:location.href, title:document.title, hasAuto:typeof autoplay, hasApi:typeof window.__api, bodyLen:document.body.innerHTML.length, result:typeof window.__result})", returnByValue: true });
  console.log("debug:", dbg.result && dbg.result.result && dbg.result.result.value);
  ws.close(); edge.kill(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

