// Isolated headless Edge verification. Never print credentials, cookies or employee rows.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origin = "http://127.0.0.1:3014";
const financialReport = process.argv.includes("--collections");
const managementReport = process.argv.includes("--management");
const navigationReport = process.argv.includes("--navigation");
const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
if (!fs.existsSync(edge)) throw new Error("Headless Edge is not installed at the configured path.");
nextEnv.loadEnvConfig(root, true);
const configured = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = configured.length ? configured.find(u => u.role === "super_admin") : { username: "admin", password: process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD };
if (!admin?.password) throw new Error("Existing local admin credentials are not configured.");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "aph-staff-browser-"));
const operator = execFileSync("whoami", { encoding: "utf8", windowsHide: true }).trim();
const acl = spawnSync("icacls", [temporary, "/inheritance:r", "/grant:r", `${operator}:(OI)(CI)F`, "*S-1-5-18:(OI)(CI)F"], { windowsHide: true, stdio: "ignore" });
if (acl.status !== 0) throw new Error("Cannot protect isolated browser profile.");
const port = await new Promise((resolve, reject) => {
  const server = net.createServer(); server.on("error", reject);
  server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const child = spawn(edge, ["--headless=new", "--inprivate", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${temporary}`, "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
let socket, sequence = 0;
const pending = new Map();
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Browser command timed out: ${method}`)); }, 20000);
    pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error("Browser evaluation failed; details suppressed to avoid secrets.");
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Expected staff UI did not become ready.");
}
function contrast(background, foreground) {
  const luminance = value => {
    const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
      const c = channel / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const left = luminance(background), right = luminance(foreground);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
try {
  let tabs;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (tabs.some(t => t.type === "page")) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const tab = tabs?.find(t => t.type === "page");
  if (!tab) throw new Error("Isolated Edge browser did not start.");
  socket = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data), item = pending.get(message.id);
    if (!item) return; clearTimeout(item.timeout); pending.delete(message.id);
    if (message.error) item.reject(new Error("Browser protocol error; no private details printed.")); else item.resolve(message.result);
  });
  await command("Page.enable"); await command("Runtime.enable");
  await command("Page.navigate", { url: `${origin}/admin/login` });
  await waitFor('location.pathname === "/admin/login" && document.readyState === "complete"');
  const loginStatus = await evaluate(`(async () => { const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: ${JSON.stringify(JSON.stringify({ username: admin.username, password: admin.password }))} }); return response.status; })()`);
  if (loginStatus !== 200) throw new Error(`Existing admin login failed: HTTP ${loginStatus}`);
  const results = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 682, height: 1012 }]) {
    await command("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1, mobile: false });
    if (navigationReport) {
      await command("Page.navigate", { url: `${origin}/admin/staff` });
      await waitFor(`location.pathname === '/admin/staff' && document.querySelector('fieldset[aria-label="Phân quyền quản lý khám sức khoẻ"]') && document.readyState === 'complete'`);
      const permissions = await evaluate(`(() => { const f=document.querySelector('fieldset[aria-label="Phân quyền quản lý khám sức khoẻ"]'); return { checkboxes:f.querySelectorAll('input[type=checkbox]').length, enabledActions:[...f.querySelectorAll('fieldset')].flatMap(s=>[...s.querySelectorAll('input')]).filter(i=>!i.matches(':disabled')).length, overflow:document.documentElement.scrollWidth>innerWidth+2 }; })()`);
      if (permissions.checkboxes !== 12 || permissions.enabledActions || permissions.overflow) throw new Error('Grouped permissions did not preserve default read-only grants: '+JSON.stringify(permissions));
      if (viewport.width < 1024) await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Menu').click()`);
      await evaluate(`document.querySelector('button[aria-controls="admin-nav-ksk_management"]').click()`);
      await waitFor(`document.querySelector('button[aria-controls="admin-nav-ksk_management"]').getAttribute('aria-expanded') === 'true'`);
      const details = await evaluate(`(() => {
        const nav=document.querySelector('nav[aria-label="Menu quản trị"]'), group=document.getElementById('admin-nav-ksk_management');
        const paths=['/admin/ksk','/admin/ksk-collections','/admin/ksk-changes','/admin/ksk-manage'];
        return { parents:nav.querySelectorAll('button[aria-controls="admin-nav-ksk_management"]').length, childLinks:group.querySelectorAll('a').length,
          uniquePaths:paths.every(p=>nav.querySelectorAll('a[href="'+p+'"]').length===1), visibleChildren:[...group.querySelectorAll('a')].every(a=>a.getBoundingClientRect().height>0),
          readable:[...group.querySelectorAll('a span')].every(s=>!s.classList.contains('sr-only')) };
      })()`);
      if (details.parents!==1 || details.childLinks!==4 || !details.uniquePaths || !details.visibleChildren || !details.readable) throw new Error('Health-check navigation is not grouped/readable.');
      const clip=await evaluate(`(() => {const r=document.querySelector('nav[aria-label="Menu quản trị"]').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()`);
      const screenshot=await command('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip});
      const target=path.join(root,'artifacts',`ksk-grouped-navigation-${viewport.width}.png`);fs.writeFileSync(target,Buffer.from(screenshot.data,'base64'));
      await evaluate(`document.querySelector('button[aria-controls="admin-nav-ksk_management"]').click()`);
      const closed=await evaluate(`getComputedStyle(document.getElementById('admin-nav-ksk_management')).display==='none'`);
      if (!closed) throw new Error('Group collapse did not hide links.');
      results.push({...viewport,...permissions,...details,collapseWorks:closed,screenshot:target});continue;
    }
    if (managementReport) {
      await command("Page.navigate", { url: `${origin}/admin/ksk-manage` });
      await waitFor(`location.pathname === '/admin/ksk-manage' && document.querySelector('form[aria-label="Chọn đợt quản lý"]') && document.readyState === 'complete'`);
      await new Promise(resolve => setTimeout(resolve, 400));
      const details = await evaluate(`(() => {
        const form=document.querySelector('form[aria-label="Chọn đợt quản lý"]'), submit=form.querySelector('button');
        const css=getComputedStyle(submit);
        return { dateInputs:form.querySelectorAll('input[type=date]').length, tabs:document.querySelectorAll('[aria-label="Phân hệ quản lý"] button').length,
          writeOff:document.body.textContent.includes('Ghi đang tắt'), alerts:document.querySelectorAll('[role=alert]').length,
          overflow:document.documentElement.scrollWidth>innerWidth+2, background:css.backgroundColor, foreground:css.color };
      })()`);
      if (details.dateInputs!==2 || details.tabs!==5 || !details.writeOff || details.alerts || details.overflow || contrast(details.background,details.foreground)<4.5) throw new Error('Management filters/tabs/write guard not rendered correctly.');
      // Only open a blank form. Never submit or create a real draft for a visual test.
      await evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Thêm đợt khám'); if(!b||b.disabled)throw new Error('Missing form action');b.click();return true; })()`);
      await waitFor(`Boolean(document.querySelector('form[aria-label="Soạn thay đổi HIS"]'))`);
      const editor = await evaluate(`(() => {const form=document.querySelector('form[aria-label="Soạn thay đổi HIS"]');return { fields:form.querySelectorAll('input,select,textarea').length, draftSave:form.textContent.includes('Lưu bản nháp — chưa ghi HIS') };})()`);
      if (!editor.draftSave || editor.fields<10) throw new Error('Real cohort editor did not open.');
      const clip=await evaluate(`(() => {const r=document.querySelector('form[aria-label="Chọn đợt quản lý"]').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:r.height,scale:1};})()`);
      const screenshot=await command('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:true,clip});
      const target=path.join(root,'artifacts',`ksk-management-filters-${viewport.width}.png`);fs.writeFileSync(target,Buffer.from(screenshot.data,'base64'));
      results.push({...viewport,...details,...editor,screenshot:target});continue;
    }
    if (financialReport) {
      await command("Page.navigate", { url: `${origin}/admin/ksk-collections` });
      await waitFor('location.pathname === "/admin/ksk-collections" && document.querySelector("select[name=cashier]") && document.readyState === "complete"');
      await waitFor('document.querySelector("select[name=cashier]").options.length > 1');
      const details = await evaluate(`(() => {
        const form = document.querySelector("form[aria-label='Lọc báo cáo thu tiền']"), button = form.querySelector("button[type=submit]");
        const css = getComputedStyle(button), alerts = document.querySelectorAll("[role=alert]").length;
        return { dateInputs: form.querySelectorAll("input[type=date]").length, cashierOptions: form.querySelector("select[name=cashier]").options.length,
          companyOptions: form.querySelector("select[name=company]").options.length, supportOptions: form.querySelector("select[name=support]").options.length,
          alerts, background: css.backgroundColor, foreground: css.color, documentOverflow: document.documentElement.scrollWidth > innerWidth + 2 };
      })()`);
      if (details.dateInputs !== 4 || details.alerts || details.documentOverflow || contrast(details.background, details.foreground) < 4.5) throw new Error("Financial report UI/filter layout is not ready.");
      await evaluate(`(() => { const select = document.querySelector("select[name=cashier]"); select.value = select.options[1].value; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
      await waitFor('document.querySelector("select[name=cashier]").selectedIndex === 1');
      const filtered = await evaluate('document.querySelector("table tbody").querySelectorAll("tr").length');
      await evaluate(`(() => { const select = document.querySelector("select[name=cashier]"); select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); })()`);
      const clip = await evaluate(`(() => { const rect = document.querySelector("form[aria-label='Lọc báo cáo thu tiền']").getBoundingClientRect(); return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height, scale: 1 }; })()`);
      const screenshot = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true, clip });
      const target = path.join(root, "artifacts", `ksk-collections-filters-${viewport.width}.png`);
      fs.writeFileSync(target, Buffer.from(screenshot.data, "base64"));
      results.push({ ...viewport, ...details, filteredVisibleRows: filtered, screenshot: target });
      continue;
    }
    await command("Page.navigate", { url: `${origin}/admin/staff` });
    await waitFor('location.pathname === "/admin/staff" && document.querySelector("input[pattern]")?.closest("form")?.querySelectorAll("button[type=submit]").length === 2 && document.readyState === "complete"');
    await evaluate('document.querySelector("input[pattern]").closest("form").scrollIntoView({ block: "start" });');
    const buttons = await evaluate(`Array.from(document.querySelector("input[pattern]").closest("form").querySelectorAll("button[type=submit]")).map(button => {
      const css = getComputedStyle(button), rect = button.getBoundingClientRect();
      return { label: button.textContent, background: css.backgroundColor, foreground: css.color, opacity: css.opacity, display: css.display,
        visible: rect.width > 0 && rect.height > 0 && css.visibility === "visible", insideViewport: rect.top >= 0 && rect.bottom <= innerHeight };
    })`);
    for (const button of buttons) {
      if (button.background !== "rgb(0, 91, 85)" || !button.visible || button.opacity !== "1" || button.display === "none" || contrast(button.background, button.foreground) < 4.5)
        throw new Error("Save button is not visually contrasting/visible in the real browser.");
    }
    if (!buttons[0].insideViewport) throw new Error("The top save button is outside the viewport after opening the form.");
    const clip = await evaluate('(() => { const rect = document.querySelector("input[pattern]").closest("form").getBoundingClientRect(); return { x: Math.max(0, rect.left + scrollX), y: Math.max(0, rect.top + scrollY), width: rect.width, height: rect.height, scale: 1 }; })()');
    if (clip.width < 300 || clip.height < 600) throw new Error("Screenshot does not capture the staff editor form.");
    const screenshot = await command("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: true, clip });
    const target = path.join(root, "artifacts", `staff-save-visible-${viewport.width}.png`);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, Buffer.from(screenshot.data, "base64"));
    results.push({ ...viewport, buttons: buttons.map(button => ({ label: button.label, background: button.background, contrast: Number(contrast(button.background, button.foreground).toFixed(2)) })), topSaveInsideViewport: true, screenshot: target });
  }
  console.log(JSON.stringify({ status: "passed", browser: "isolated headless Edge", noStaffOrHisMutations: true, results }));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await evaluate('fetch("/api/admin/logout", { method: "POST" }).then(() => true)'); } catch {}
    try { await command("Browser.close"); } catch {}
    socket.close();
  }
  for (const item of pending.values()) clearTimeout(item.timeout);
  if (child.exitCode === null) spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  const absolute = path.resolve(temporary);
  if (path.dirname(absolute) !== path.resolve(os.tmpdir()) || !path.basename(absolute).startsWith("aph-staff-browser-")) throw new Error("Unsafe browser temp cleanup refused.");
  try { fs.rmSync(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  catch { console.warn("Isolated browser profile remains in protected temporary directory; no existing browser was touched."); }
}
