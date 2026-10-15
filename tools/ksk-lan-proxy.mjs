// Fixed LAN HTTPS gateway. Oracle and Next.js remain on loopback, not public listeners.
import https from "node:https";
import http from "node:http";
import fs from "node:fs";

const address = "192.168.2.8", port = Number(process.env.KSK_LAN_PORT || 3443), host = `${address}:${port}`;
if (![3014, 3443].includes(port)) throw new Error("Only approved CN1 LAN ports are supported.");
if (!process.env.KSK_LAN_CERT || !process.env.KSK_LAN_KEY) throw new Error("LAN TLS certificate is not configured.");
const upstream = { hostname: "127.0.0.1", port: 3014 };
const allowedClient = req => (req.socket.remoteAddress || "").replace(/^::ffff:/, "").startsWith("192.168.2.");
const allowedPath = path => path === "/admin" || path.startsWith("/admin/") || path.startsWith("/api/admin/") || path.startsWith("/_next/");
function forwarded(req) {
  const headers = { ...req.headers, host };
  for (const key of Object.keys(headers)) if (key.startsWith("x-forwarded-") || ["forwarded", "x-real-ip", "x-admin-path", "x-middleware-subrequest"].includes(key)) delete headers[key];
  headers["x-forwarded-proto"] = "https"; headers["x-forwarded-host"] = host; headers["x-forwarded-for"] = req.socket.remoteAddress;
  return headers;
}
const server = https.createServer({ cert: fs.readFileSync(process.env.KSK_LAN_CERT), key: fs.readFileSync(process.env.KSK_LAN_KEY), minVersion: "TLSv1.2", requestTimeout: 70000 }, (req, res) => {
  res.setHeader("Cache-Control", "no-store, private"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("X-Content-Type-Options", "nosniff");
  if (!allowedClient(req) || req.headers.host !== host) { res.writeHead(403); res.end("LAN CN1 only."); return; }
  let url;
  try { url = new URL(req.url, `https://${host}`); if (!req.url.startsWith("/") || req.url.startsWith("//")) throw new Error(); }
  catch { res.writeHead(400); res.end(); return; }
  if (url.pathname === "/") { res.writeHead(302, { Location: "/admin/login" }); res.end(); return; }
  if (!allowedPath(url.pathname)) { res.writeHead(404); res.end(); return; }
  if (!["GET", "HEAD", "POST"].includes(req.method)) { res.writeHead(405); res.end(); return; }
  if (req.method === "POST" && req.headers.origin !== `https://${host}`) { res.writeHead(403); res.end("Same-origin required."); return; }
  const proxy = http.request({ ...upstream, path: url.pathname + url.search, method: req.method, headers: forwarded(req), timeout: 65000 }, response => {
    const headers = { ...response.headers, "cache-control": "no-store, private", "referrer-policy": "no-referrer" };
    if (headers.location) {
      try {
        const destination = new URL(headers.location, `https://${host}`);
        if (![host, "127.0.0.1:3014", "localhost:3014"].includes(destination.host) || !allowedPath(destination.pathname)) throw new Error();
        headers.location = `https://${host}${destination.pathname}${destination.search}${destination.hash}`;
      } catch { response.destroy(); res.writeHead(502); res.end("Unexpected upstream redirect."); return; }
    }
    res.writeHead(response.statusCode || 502, headers); response.pipe(res);
  });
  proxy.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("Local web unavailable."); });
  proxy.on("timeout", () => proxy.destroy()); req.on("aborted", () => proxy.destroy()); req.pipe(proxy);
});
// Development preview HMR uses WebSocket, but only its fixed path can be upgraded.
server.on("upgrade", (req, socket, head) => {
  if (!allowedClient(req) || req.headers.host !== host || req.headers.origin !== `https://${host}` || !req.url?.startsWith("/_next/webpack-hmr")) { socket.destroy(); return; }
  const proxy = http.request({ ...upstream, path: req.url, headers: forwarded(req) });
  proxy.on("upgrade", (response, upstreamSocket, upstreamHead) => {
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join("\r\n")}\r\n\r\n`);
    if (head.length) upstreamSocket.write(head); if (upstreamHead.length) socket.write(upstreamHead);
    socket.pipe(upstreamSocket); upstreamSocket.pipe(socket);
    upstreamSocket.on("error", () => socket.destroy()); socket.on("error", () => upstreamSocket.destroy());
  });
  proxy.on("error", () => socket.destroy()); proxy.end();
});
server.on("error", () => { console.error("LAN HTTPS gateway could not start; check address/port/certificate."); process.exit(1); });
server.listen(port, address, () => console.log(`LAN HTTPS ready: https://${host}/admin/login`));
