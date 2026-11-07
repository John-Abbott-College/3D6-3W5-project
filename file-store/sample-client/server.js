// Simple file storage service. No dependencies, Node 18+.
//   GET    /files        list stored files (newest first)
//   POST   /files        raw request body = file  -> 201 { id, url, ... }
//   GET    /files/:id    returns the file
//   DELETE /files/:id    deletes the file         -> 204
//
// Run:  node server.js        (optional: PORT=4000 node server.js)

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");

const PORT = process.env.PORT || 3000;
const HOST = "127.0.0.1"; // local machine only
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DATA_DIR = path.join(__dirname, "data");

const ID_RE = /^\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

fs.mkdirSync(DATA_DIR, { recursive: true });

const filePath = (id) => path.join(DATA_DIR, id);
const metaPath = (id) => path.join(DATA_DIR, id + ".json");

function send(res, status, body, headers = {}) {
  const isObj = body !== undefined && typeof body === "object";
  const payload = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    ...(isObj && { "Content-Type": "application/json" }),
    ...headers,
  });
  res.end(payload);
}

async function upload(req, res) {
  const declared = Number(req.headers["content-length"]);
  if (declared > MAX_BYTES) {
    return send(res, 413, { error: "File exceeds 10 MB limit" }, { Connection: "close" });
  }

  const id = crypto.randomUUID();
  const tmp = filePath(id) + ".tmp";
  const url = new URL(req.url, "http://localhost");
  const meta = {
    id,
    filename: url.searchParams.get("filename") || req.headers["x-filename"] || null,
    contentType: req.headers["content-type"] || "application/octet-stream",
    size: 0,
    createdAt: new Date().toISOString(),
  };

  // Count bytes as they arrive so the limit holds even without a Content-Length header.
  let size = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      size += chunk.length;
      if (size > MAX_BYTES) return cb(new Error("TOO_LARGE"));
      cb(null, chunk);
    },
  });

  try {
    await pipeline(req, limiter, fs.createWriteStream(tmp));
  } catch (err) {
    await fsp.rm(tmp, { force: true });
    if (err.message === "TOO_LARGE") {
      return send(res, 413, { error: "File exceeds 10 MB limit" }, { Connection: "close" });
    }
    console.error(err);
    return send(res, 500, { error: "Upload failed" });
  }

  if (size === 0) {
    await fsp.rm(tmp, { force: true });
    return send(res, 400, { error: "Empty body" });
  }

  meta.size = size;
  await fsp.rename(tmp, filePath(id));
  await fsp.writeFile(metaPath(id), JSON.stringify(meta));
  send(res, 201, { ...meta, url: `/files/${id}` }, { Location: `/files/${id}` });
}

async function list(res) {
  const names = (await fsp.readdir(DATA_DIR)).filter((n) => n.endsWith(".json"));
  const items = [];
  for (const n of names) {
    try {
      const m = JSON.parse(await fsp.readFile(path.join(DATA_DIR, n), "utf8"));
      items.push({ ...m, url: `/files/${m.id}` });
    } catch {} // skip unreadable or half-deleted entries
  }
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  send(res, 200, items);
}

async function download(id, req, res) {
  let meta;
  try {
    meta = JSON.parse(await fsp.readFile(metaPath(id), "utf8"));
  } catch {
    return send(res, 404, { error: "Not found" });
  }

  const headers = {
    "Content-Type": meta.contentType,
    "Content-Length": meta.size,
    "X-Content-Type-Options": "nosniff",
  };
  if (meta.filename) {
    headers["Content-Disposition"] =
      `inline; filename*=UTF-8''${encodeURIComponent(meta.filename)}`;
  }
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();

  try {
    await pipeline(fs.createReadStream(filePath(id)), res);
  } catch {
    res.destroy(); // client went away or file vanished mid-read
  }
}

async function remove(id, res) {
  try {
    await fsp.access(metaPath(id));
  } catch {
    return send(res, 404, { error: "Not found" });
  }
  await fsp.rm(filePath(id), { force: true });
  await fsp.rm(metaPath(id), { force: true });
  send(res, 204);
}

const server = http.createServer(async (req, res) => {
  // CORS: lets a page served by Live Server (a different port) call this API.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
  res.setHeader("Access-Control-Expose-Headers", "Location, Content-Disposition");

  if (req.method === "OPTIONS") return send(res, 204);

  try {
    const { pathname } = new URL(req.url, "http://localhost");

    if (pathname === "/files" && req.method === "GET") return await list(res);
    if (pathname === "/files" && req.method === "POST") return await upload(req, res);

    const m = ID_RE.exec(pathname);
    if (m) {
      const id = m[1].toLowerCase();
      if (req.method === "GET" || req.method === "HEAD") return await download(id, req, res);
      if (req.method === "DELETE") return await remove(id, res);
      return send(res, 405, { error: "Method not allowed" });
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: "Server error" });
    else res.destroy();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`File store listening on http://${HOST}:${PORT}  (data: ${DATA_DIR})`);
});
