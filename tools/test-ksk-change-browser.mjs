// Full synthetic story, isolated production server + temporary staff store + isolated Edge.
// Never connect to HIS or write actual operator employee accounts. No secrets in output.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aph-change-browser-"));
const operator = execFileSync("whoami", { encoding: "utf8", windowsHide: true }).trim();
if (spawnSync("icacls", [temporary, "/inheritance:r", "/grant:r", `${operator}:(OI)(CI)F`, "*S-1-5-18:(OI)(CI)F"], { windowsHide: true, stdio: "ignore" }).status !== 0) throw new Error("Cannot protect isolated test directory.");
async function freePort() {
  return new Promise((resolve, reject) => { const server = net.createServer(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); });
}
const port = await freePort(), debugPort = await freePort(), origin = `http://127.0.0.1:${port}`;
const password = `Lab${randomBytes(20).toString("hex")}`, labFile = path.join(temporary, "lab.json");
const server = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root, windowsHide: true, stdio: "ignore", env: { ...process.env, NODE_ENV: "production", VERCEL: "", KSK_ENABLED: "false", KSK_DATA_MODE: "disabled",
    KSK_CHANGE_LAB_ENABLED: "true", KSK_CHANGE_STORE_PATH: labFile, ADMIN_STAFF_ENABLED: "true", ADMIN_STAFF_STORE_PATH: path.join(temporary, "staff.json"),
    PORTAL_SESSION_SECRET: randomBytes(32).toString("hex"), ADMIN_USERS_JSON: JSON.stringify([{ username: "lab-admin", password, role: "super_admin" }]) },
});
let browser, socket, sequence = 0;
const pending = new Map(), runtimeErrors = [];
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timeout: ${method}`)); }, 25000);
    pending.set(id, { resolve, reject, timeout, method }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser story evaluation failed; private details suppressed.");
  return result.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 60; i++) { if (await evaluate(`Boolean(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 250)); }
  throw new Error("Expected LAB UI state did not appear.");
}
async function login(username) {
  const status = await evaluate(`fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:${JSON.stringify(JSON.stringify({ username, password }))} }).then(r => r.status)`);
  if (status !== 200) throw new Error(`Synthetic login failed: ${status}`);
}
function setValue(selector, value, prototype = "HTMLInputElement") {
  return evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(${prototype}.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles:true })); return true; })()`);
}
function click(label) {
  return evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(label)}); if(!button || button.disabled) throw new Error('Button unavailable'); button.click(); return true; })()`);
}
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Isolated production server exited.");
    try { if ((await fetch(`${origin}/api/admin/ksk-changes`, { signal: AbortSignal.timeout(1500) })).status === 401) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Isolated production server not ready; build the app first.");
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  browser = spawn(edge, ["--headless=new", "--inprivate", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${path.join(temporary, "edge")}`, "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${debugPort}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let tabs;
  for (let i = 0; i < 40; i++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); if (tabs.some(t => t.type === "page")) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const tab = tabs?.find(t => t.type === "page"); if (!tab) throw new Error("Edge not ready.");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(true);
    const item = pending.get(message.id); if (!item) return;
    clearTimeout(item.timeout); pending.delete(message.id);
    if (message.error) item.reject(new Error(`Browser protocol error in ${item.method}: ${message.error.code} ${message.error.message}`)); else item.resolve(message.result);
  });
  await command("Page.enable"); await command("Runtime.enable");
  await command("Page.navigate", { url: `${origin}/admin/login` }); await waitFor('document.readyState === "complete" && location.pathname === "/admin/login"');
  await login("lab-admin");
  for (const [username, actions] of [["lab-maker", ["ksk_package_draft", "ksk_roster_draft"]], ["lab-checker", ["ksk_change_approve", "ksk_change_apply"]]]) {
    const body = { username, displayName: "Nhân viên GIẢ LẬP", password, confirmPassword: password, enabled: true, menus: ["ksk_changes"], actions };
    const status = await evaluate(`fetch('/api/admin/staff',{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(body))}}).then(r=>r.status)`);
    if (status !== 200) throw new Error(`Temporary employee provisioning failed: ${status}`);
  }
  await evaluate("fetch('/api/admin/logout',{method:'POST',redirect:'manual'}).then(r=>r.status)"); await login("lab-maker");
  await command("Page.navigate", { url: `${origin}/admin/ksk-changes` });
  await waitFor(`document.readyState === "complete" && document.querySelector('form[aria-label="Lập phiếu thay đổi"]')`);
  const menuSafe = await evaluate("![...document.querySelectorAll('nav a')].some(a=>a.getAttribute('href')==='/admin/staff')");
  if (!menuSafe) throw new Error("Maker can see staff management navigation.");
  await setValue('form[aria-label="Lập phiếu thay đổi"] input[maxlength="120"]', "Gói đã sửa GIẢ LẬP");
  await setValue('form[aria-label="Lập phiếu thay đổi"] textarea', "Điều chỉnh gói để kiểm thử", "HTMLTextAreaElement");
  await click("Lưu bản nháp"); await waitFor(`document.querySelector('section[aria-label="Chi tiết phiếu thay đổi"]') && document.querySelector('[role=status]')`);
  await setValue('section[aria-label="Chi tiết phiếu thay đổi"] textarea', "Gửi kiểm tra nội dung giả lập", "HTMLTextAreaElement");
  await click("Gửi duyệt"); await waitFor(`document.querySelector('section[aria-label="Chi tiết phiếu thay đổi"]').textContent.includes("Không được tự duyệt")`);
  const denied = await evaluate(`(async()=>{const data=await (await fetch('/api/admin/ksk-changes')).json();const d=data.drafts[0];return (await fetch('/api/admin/ksk-changes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve',id:d.id,revision:d.revision,reason:'Tự duyệt phải bị chặn'})})).status;})()`);
  if (denied !== 403) throw new Error("Maker approval permission was not denied.");
  await evaluate("fetch('/api/admin/logout',{method:'POST',redirect:'manual'}).then(r=>r.status)"); await login("lab-checker");
  await command("Page.navigate", { url: `${origin}/admin/ksk-changes` }); await waitFor('document.readyState === "complete" && [...document.querySelectorAll("button")].some(b=>b.textContent==="Xem / xử lý phiếu")');
  await click("Xem / xử lý phiếu");
  await setValue('section[aria-label="Chi tiết phiếu thay đổi"] textarea', "Đã đối chiếu trước và sau", "HTMLTextAreaElement");
  await click("Duyệt phiếu"); await waitFor('[...document.querySelectorAll("button")].some(b=>b.textContent==="Áp dụng HIS GIẢ LẬP")');
  await setValue('section[aria-label="Chi tiết phiếu thay đổi"] textarea', "Áp dụng vào nguồn GIẢ LẬP", "HTMLTextAreaElement");
  await evaluate(`document.querySelector('section[aria-label="Chi tiết phiếu thay đổi"] input[type=checkbox]').click()`);
  await click("Áp dụng HIS GIẢ LẬP"); await waitFor(`document.querySelector('section[aria-label="Chi tiết phiếu thay đổi"]').textContent.includes("Đã áp dụng GIẢ LẬP")`);
  const replay = await evaluate(`(async()=>{const data=await (await fetch('/api/admin/ksk-changes')).json();const d=data.drafts[0];return (await fetch('/api/admin/ksk-changes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'apply_simulation',id:d.id,revision:d.revision,reason:'Gửi lại không ghi hai lần'})})).status;})()`);
  if (replay !== 409) throw new Error("Repeated application not blocked.");
  const stored = JSON.parse(fs.readFileSync(labFile, "utf8"));
  if (stored.drafts[0].state !== "simulated" || stored.drafts[0].history.length !== 4 || stored.targets[0].value.name !== "Gói đã sửa GIẢ LẬP") throw new Error("Persistent mock/audit state mismatch.");
  const screens = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 682, height: 1012 }]) {
    await command("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1, mobile: false });
    // Let the responsive sidebar's 200ms transform finish before capturing it.
    await new Promise(resolve => setTimeout(resolve, 400));
    await evaluate("scrollTo(0,0)");
    const overflow = await evaluate("document.documentElement.scrollWidth > innerWidth+2");
    if (overflow) throw new Error("LAB page overflows document width.");
    const picture = await command("Page.captureScreenshot", { format: "png", fromSurface: true });
    const target = path.join(root, "artifacts", `ksk-change-lab-${viewport.width}.png`); fs.writeFileSync(target, Buffer.from(picture.data, "base64"));
    screens.push({ ...viewport, documentOverflow: false, screenshot: target });
  }
  if (runtimeErrors.length) throw new Error("Browser runtime exception detected.");
  console.log(JSON.stringify({ status: "passed", mode: "simulation", productionBuild: true, separateStaffAccounts: 2, sourceMutationAfterApprovalOnly: true,
    makerApprovalDenied: denied, applyReplayBlocked: replay, persistedAuditEvents: stored.drafts[0].history.length, realHisWrites: false, realStaffMutations: false, runtimeErrors: 0, screens }));
} finally {
  if (socket?.readyState === WebSocket.OPEN) { try { await command("Browser.close"); } catch {} socket.close(); }
  for (const item of pending.values()) clearTimeout(item.timeout);
  for (const child of [browser, server]) if (child && child.exitCode === null) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  const absolute = path.resolve(temporary);
  if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith("aph-change-browser-")) throw new Error("Unsafe test cleanup refused.");
  try { fs.rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { console.warn("Protected synthetic test directory retained; existing operator data untouched."); }
}
