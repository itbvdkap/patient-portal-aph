// TLS-verified LAN smoke. Print status/counts only; never credentials, cookies or patient rows.
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root, true);
const port = process.argv.includes("--port3014") ? 3014 : 3443;
const host = `192.168.2.8:${port}`, origin = `https://${host}`;
const agent = new https.Agent({ ca: fs.readFileSync(path.join(root, "artifacts/ksk-cn1-lan/cn1-server.cert.pem")), rejectUnauthorized: true });
const configured = process.env.ADMIN_USERS_JSON ? JSON.parse(process.env.ADMIN_USERS_JSON) : [];
const admin = configured.length ? configured.find(u => u.role === "super_admin") : { username: "admin", password: process.env.ADMIN_PASSWORD || process.env.PORTAL_ADMIN_PASSWORD };
async function request(url, method = "GET", cookie, payload) {
  return await new Promise((resolve, reject) => {
    const req = https.request(`${origin}${url}`, { method, agent, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(payload ? { Origin: origin, "Content-Type": "application/json" } : {}) }, timeout: 65000 }, res => {
      const chunks = []; res.on("data", c => chunks.push(c)); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", () => reject(new Error("LAN TLS/request failed; no secret output."))); req.on("timeout", () => req.destroy()); req.end(payload ? JSON.stringify(payload) : undefined);
  });
}
const loginPage = await request("/admin/login");
if (loginPage.status !== 200) throw new Error(`LAN login page: ${loginPage.status}`);
const ready = await request("/admin/lan-ready.gif");
if (ready.status !== 200 || ready.headers["content-type"] !== "image/gif" || !ready.headers["cache-control"]?.includes("no-store"))
  throw new Error("LAN reachability marker failed.");
const anon = await request("/api/admin/ksk?from=2026-10-01&to=2026-10-14");
if (anon.status !== 401) throw new Error("Anonymous LAN KSK API not blocked.");
const anonPage = await request("/admin/ksk");
if (![303, 307].includes(anonPage.status) || anonPage.headers.location !== `${origin}/admin/login`) throw new Error("Anonymous page redirect is not the LAN HTTPS login.");
const login = await request("/api/admin/login", "POST", null, admin);
const sessionHeader = login.headers["set-cookie"]?.find(c => c.startsWith("aph_admin_session="));
if (login.status !== 200 || !sessionHeader?.includes("Secure") || !sessionHeader.includes("HttpOnly")) throw new Error("LAN login/Secure cookie failed.");
const cookie = sessionHeader.split(";")[0];
const staffPage = await request("/admin/staff", "GET", cookie);
if (staffPage.status !== 200 || !staffPage.body.includes("Menu được phép xem")) throw new Error("LAN staff management UI failed.");
if (!staffPage.body.includes("Lưu nhân viên") || !staffPage.body.includes("Nhập lại mật khẩu") || !staffPage.body.includes("sticky top-20")) throw new Error("Staff save toolbar/password confirmation not rendered.");
const roster = await request("/api/admin/staff", "GET", cookie);
if (roster.status !== 200 || !roster.headers["cache-control"]?.includes("no-store")) throw new Error("LAN staff API failed.");
const staffPayload = JSON.parse(roster.body);
if (staffPayload.users.some(u => "passwordHash" in u || "revision" in u || "password" in u)) throw new Error("Private staff fields leaked.");
// Invalid/read-only probes only: no real employee or credential mutations.
const mismatch = await request("/api/admin/staff", "POST", cookie, { username: "invalid-probe-only", displayName: "Probe", enabled: false, menus: [], password: "TestOnlyInvalid12345", confirmPassword: "mismatch" });
if (mismatch.status !== 400) throw new Error("Server did not reject mismatched staff password confirmation.");
const deleteMismatch = await request("/api/admin/staff/delete", "POST", cookie, { username: "invalid-probe-only", confirmUsername: "mismatch" });
if (deleteMismatch.status !== 400) throw new Error("Server did not reject mismatched delete confirmation.");
const anonymousPassword = await request("/api/admin/password", "POST", null, {});
if (anonymousPassword.status !== 401) throw new Error("Unauthenticated password changes not blocked.");
const bootstrapPassword = await request("/api/admin/password", "POST", cookie, {});
if (bootstrapPassword.status !== 403) throw new Error("Server-configured admin credential was exposed to staff self-service.");
const anonymousPasswordPage = await request("/admin/password");
if (![303, 307].includes(anonymousPasswordPage.status) || anonymousPasswordPage.headers.location !== `${origin}/admin/login`) throw new Error("Password page not protected.");
const portal = await request("/api/me");
if (portal.status !== 404) throw new Error("LAN gateway exposes routes outside admin scope.");
const logout = await request("/api/admin/logout", "POST", cookie, {});
if (logout.status !== 303 || logout.headers.location !== `${origin}/admin/login`) throw new Error("LAN logout redirects away from HTTPS admin host.");
console.log(JSON.stringify({ status: "passed", tlsVerified: true, url: origin + "/admin/login", loginPage: loginPage.status, secureCookie: true,
  reachabilityMarker: ready.status,
  anonymousKsk: anon.status, staffPage: staffPage.status, staffApi: roster.status, staffCount: staffPayload.users.length, privateFieldsOmitted: true, nonAdminRoutesBlocked: true, logout: logout.status,
  visibleSaveToolbar: true, passwordConfirmation: true, mismatchedCreateBlocked: mismatch.status, mismatchedDeleteBlocked: deleteMismatch.status, anonymousPasswordBlocked: anonymousPassword.status, bootstrapPasswordProtected: bootstrapPassword.status,
  remotePcReachability: "Not verified: Windows firewall rule needs elevated operator action." }));
agent.destroy();
