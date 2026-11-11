// File storage service. No dependencies, Node 18+.
// File bytes live on disk in ./data/<id>; file metadata lives in MSSQL, reached through DAB.
//   GET    /files        list stored files (newest first)
//   POST   /files        raw request body = file  -> 201 { id, url, ... }
//   GET    /files/:id    returns the file
//   DELETE /files/:id    deletes the file         -> 204
//
// Run:  node server.js                 start the service
//       node server.js --init <dir>    reset: delete every stored file, import every file in <dir>, then exit
// (environment variables are described in README.md)

const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream/promises");
const { Transform } = require("node:stream");

const PORT = Number(process.env.PORT) || 3000;

// Fixed on purpose. Listening on the loopback address makes this service unreachable from other
// machines. Do not make it configurable and do not change it to 0.0.0.0.
const HOST = "127.0.0.1";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DATA_DIR = path.join(__dirname, "data");

// DAB base URL. Use 127.0.0.1 rather than "localhost": Node 18+ may resolve "localhost" to the
// IPv6 address ::1, and a DAB bound to 127.0.0.1 would then refuse the connection.
const DAB_URL = new URL(process.env.DAB_URL || "http://127.0.0.1:5000/api");
const DAB_API_PATH = DAB_URL.pathname.replace(/\/+$/, ""); // "/api"
const DAB_TIMEOUT_MS = 10_000;

// Browser pages allowed to call this service (e.g. VS Code Live Server).
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "http://127.0.0.1:5500,http://localhost:5500")
    .split(",").map((s) => s.trim()).filter(Boolean)
);
// Host headers we accept. Anything else (e.g. a DNS-rebinding attack) is refused.
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = new RegExp("^/files/(" + UUID_RE.source.slice(1, -1) + ")$", "i");

fs.mkdirSync(DATA_DIR, { recursive: true });
// Remove temp files left behind by uploads that were interrupted by a crash.
for (const n of fs.readdirSync(DATA_DIR)) {
  if (n.endsWith(".tmp")) fs.rmSync(path.join(DATA_DIR, n), { force: true });
}

const filePath = (id) => path.join(DATA_DIR, id);

// ---------- DAB (metadata in MSSQL) ----------

class DabError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // HTTP status from DAB, or 0 if DAB could not be reached
  }
}

// Calls DAB's REST API. `relative` is the part after /api, e.g. "/StoredFile/Id/<guid>".
async function dab(relative, { method = "GET", body } = {}) {
  const url = DAB_URL.origin + DAB_API_PATH + relative;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(DAB_TIMEOUT_MS),
    });
  } catch (err) {
    throw new DabError(`Cannot reach DAB at ${DAB_URL.origin} (${err.cause?.code || err.name})`, 0);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new DabError(`DAB ${method} ${relative} returned ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new DabError(`DAB ${method} ${relative} returned invalid JSON`, 502);
  }
}

// DATETIME2 has no time zone; the table stores UTC, so add the Z if DAB leaves it off.
function toIso(v) {
  if (typeof v !== "string") return v;
  const withZone = /(Z|[+-]\d\d:?\d\d)$/i.test(v) ? v : v + "Z";
  const d = new Date(withZone);
  return isNaN(d) ? v : d.toISOString();
}

// DAB row (PascalCase columns) -> the JSON shape this service has always returned.
function toMeta(row) {
  const id = String(row.Id).toLowerCase();
  return {
    id,
    filename: row.Filename ?? null,
    contentType: row.ContentType,
    size: Number(row.Size),
    createdAt: toIso(row.CreatedAt),
    url: `/files/${id}`,
  };
}

// A missing key gives 200 with an empty list (some versions: 404). Treat both as "not found".
async function findMeta(id) {
  try {
    const data = await dab(`/StoredFile/Id/${id}`);
    return data?.value?.length ? toMeta(data.value[0]) : null;
  } catch (err) {
    if (err instanceof DabError && err.status === 404) return null;
    throw err;
  }
}

// DAB's nextLink is an absolute URL; keep only its path and query and re-base it on DAB_URL.
function relativeFromNextLink(link) {
  const u = new URL(link, DAB_URL.origin);
  const p = u.pathname.startsWith(DAB_API_PATH) ? u.pathname.slice(DAB_API_PATH.length) : u.pathname;
  return p + u.search;
}

// ---- The only functions that change or list metadata in DAB. Both the HTTP routes and --init use them. ----

// Registers a file's metadata. SQL Server generates Id and CreatedAt; DAB returns the new row.
async function registerFile({ filename, contentType, size }) {
  const sent = {
    Filename: filename ? String(filename).slice(0, 255) : null, // column lengths
    ContentType: String(contentType).slice(0, 255),
    Size: size,
  };
  const data = await dab("/StoredFile", { method: "POST", body: sent });
  const row = data?.value?.[0];
  if (!row?.Id || !UUID_RE.test(String(row.Id))) {
    // The row exists but we can't name it, so it can't be rolled back automatically.
    throw new DabError("DAB did not return the new Id (the StoredFile entity needs both 'create' and 'read' permission)", 502);
  }
  return toMeta({ ...sent, ...row });
}

// Deletes a file's metadata row. Returns false if there was no such row.
async function unregisterFile(id) {
  try {
    await dab(`/StoredFile/Id/${id}`, { method: "DELETE" });
    return true;
  } catch (err) {
    if (err instanceof DabError && err.status === 404) return false;
    throw err;
  }
}

// Every metadata row, newest first, following DAB's pagination.
async function listAllMeta() {
  const items = [];
  let next = `/StoredFile?$orderby=${encodeURIComponent("CreatedAt desc")}&$first=-1`;
  for (let page = 0; next && page < 1000; page++) {
    const data = await dab(next);
    for (const row of data?.value ?? []) items.push(toMeta(row));
    next = data?.nextLink ? relativeFromNextLink(data.nextLink) : null;
  }
  return items;
}

// ---------- File bytes on disk ----------

async function removeStoredBytes(id) {
  try {
    await fsp.rm(filePath(id), { force: true });
  } catch (err) {
    console.error(`File ${id} could not be removed from ${DATA_DIR}: ${err.message}`);
  }
}

// Removes everything inside data/ (files, leftovers from older versions, subfolders), but not
// the folder itself. Returns how many entries were removed.
async function emptyDataDir() {
  const names = await fsp.readdir(DATA_DIR);
  for (const n of names) await fsp.rm(path.join(DATA_DIR, n), { recursive: true, force: true });
  return names.length;
}

// Registers the metadata (which makes the database generate the id), then puts the bytes at
// data/<id> using `place(destPath)`: a rename for uploads, a copy for --init. If placing the
// bytes fails, the new row is removed again so nothing half-registered is left behind.
async function addFile({ filename, contentType, size }, place) {
  const meta = await registerFile({ filename, contentType, size });
  try {
    await place(filePath(meta.id));
  } catch (err) {
    try {
      await unregisterFile(meta.id);
    } catch (e) {
      console.error(`Rollback failed, orphan row ${meta.id}: ${e.message}`);
    }
    await removeStoredBytes(meta.id);
    throw err;
  }
  return meta;
}

// ---------- HTTP helpers ----------

function send(res, status, body, headers = {}) {
  const isObj = body !== undefined && typeof body === "object";
  const payload = isObj ? JSON.stringify(body) : body;
  res.writeHead(status, {
    ...(isObj && { "Content-Type": "application/json" }),
    ...headers,
  });
  res.end(payload);
}

function sendError(res, err) {
  if (err instanceof DabError) {
    console.error(err.message);
    return send(res, 502, { error: "Metadata service (DAB) unavailable or returned an error" });
  }
  console.error(err);
  send(res, 500, { error: "Server error" });
}

// ---------- Routes ----------

async function upload(req, res) {
  const declared = Number(req.headers["content-length"]);
  if (declared > MAX_BYTES) {
    return send(res, 413, { error: "File exceeds 10 MB limit" }, { Connection: "close" });
  }

  // The id doesn't exist yet: the database generates it. Stream to a temp file first.
  const tmp = filePath(crypto.randomUUID() + ".tmp");
  const url = new URL(req.url, "http://localhost");
  const filename = url.searchParams.get("filename") || req.headers["x-filename"] || null;
  const contentType = req.headers["content-type"] || "application/octet-stream";

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

  // Register the file (SQL Server generates Id and CreatedAt), then move the temp file into place.
  let meta;
  try {
    meta = await addFile({ filename, contentType, size }, (dest) => fsp.rename(tmp, dest));
  } catch (err) {
    await fsp.rm(tmp, { force: true });
    if (err instanceof DabError) return sendError(res, err);
    console.error(err);
    return send(res, 500, { error: "Upload failed" });
  }
  send(res, 201, meta, { Location: meta.url });
}

async function list(res) {
  try {
    send(res, 200, await listAllMeta());
  } catch (err) {
    sendError(res, err);
  }
}

async function download(id, req, res) {
  let meta;
  try {
    meta = await findMeta(id);
  } catch (err) {
    return sendError(res, err);
  }
  if (!meta) return send(res, 404, { error: "Not found" });

  let stat;
  try {
    stat = await fsp.stat(filePath(id));
  } catch {
    console.error(`Row ${id} exists but its file is missing from ${DATA_DIR}`);
    return send(res, 404, { error: "Not found" });
  }

  const headers = {
    "Content-Type": meta.contentType,
    "Content-Length": stat.size, // what we will actually send
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
  // Row first, then file: a failure in between leaves a harmless orphan file, not a dangling row.
  let found;
  try {
    found = await unregisterFile(id);
  } catch (err) {
    return sendError(res, err);
  }
  if (!found) return send(res, 404, { error: "Not found" });
  await removeStoredBytes(id);
  send(res, 204);
}

// ---------- Server ----------

const server = http.createServer(async (req, res) => {
  // 1. Only accept requests addressed to this machine's loopback names (blocks DNS rebinding).
  if (!ALLOWED_HOSTS.has((req.headers.host || "").toLowerCase())) {
    return send(res, 403, { error: "Forbidden host" }, { Connection: "close" });
  }

  // 2. Browsers attach Origin to cross-site requests. Only our own pages may call this API;
  //    other sites get a 403 before anything is read, uploaded or deleted.
  const origin = req.headers.origin;
  if (origin !== undefined) {
    if (!ALLOWED_ORIGINS.has(origin)) {
      return send(res, 403, { error: "Origin not allowed" }, { Connection: "close" });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Filename");
    res.setHeader("Access-Control-Expose-Headers", "Location, Content-Disposition");
  }

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

// ---------- --init <dir> ----------

const CONTENT_TYPES = {
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json",
  ".xml": "application/xml", ".pdf": "application/pdf", ".zip": "application/zip",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".mp4": "video/mp4", ".webm": "video/webm",
};
const contentTypeFor = (name) =>
  CONTENT_TYPES[path.extname(name).toLowerCase()] || "application/octet-stream";

let initChangedStore = false; // set once --init starts deleting, to word the failure message

// Deletes every stored file, then imports every regular file in `dirArg` (flat folder).
// Returns the process exit code.
async function runInit(dirArg) {
  const srcDir = path.resolve(dirArg);
  const rel = path.relative(DATA_DIR, srcDir);
  if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
    throw new Error("<dir> must not be the service's data folder or inside it, because --init empties that folder");
  }

  // 1. Look at the source folder first, so a bad argument is caught before anything is deleted.
  let entries;
  try {
    entries = await fsp.readdir(srcDir, { withFileTypes: true });
  } catch (err) {
    throw new Error(`Cannot read folder ${srcDir} (${err.code || err.message})`);
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const toImport = [];
  const skipped = [];
  for (const e of entries) {
    if (!e.isFile()) {
      skipped.push(`${e.name} (${e.isDirectory() ? "subfolder" : "not a regular file"})`);
      continue;
    }
    const full = path.join(srcDir, e.name);
    const { size } = await fsp.stat(full);
    if (size === 0) skipped.push(`${e.name} (empty)`);
    else if (size > MAX_BYTES) skipped.push(`${e.name} (over the 10 MB limit)`);
    else toImport.push({ name: e.name, full, size });
  }
  console.log(`Init from ${srcDir}: ${toImport.length} file(s) to import, ${skipped.length} skipped`);

  // 2. Delete every row the database knows about. Listing first proves DAB is reachable
  //    before anything is deleted.
  const existing = await listAllMeta();
  console.log(`Deleting ${existing.length} file record(s) from the database...`);
  initChangedStore = true;
  for (const m of existing) await unregisterFile(m.id);

  //    Then empty data/ completely. The table may have been dropped or recreated since these files
  //    were stored, so the folder can hold files the database no longer knows about.
  const removedFromData = await emptyDataDir();
  console.log(`Emptied data/: removed ${removedFromData} entr${removedFromData === 1 ? "y" : "ies"}.`);

  // 3. Import: the same addFile() as an HTTP upload, but the bytes are copied by the filesystem.
  const imported = [];
  const failed = [];
  for (const f of toImport) {
    try {
      const meta = await addFile(
        { filename: f.name, contentType: contentTypeFor(f.name), size: f.size },
        (dest) => fsp.copyFile(f.full, dest)
      );
      imported.push(meta);
      console.log(`  imported ${f.name}  ->  ${meta.id}`);
    } catch (err) {
      if (err instanceof DabError && err.status === 0) throw err; // DAB is gone: stop
      failed.push(f.name);
      console.error(`  FAILED   ${f.name}: ${err.message}`);
    }
  }

  // 4. Report.
  console.log(`Done: ${existing.length} database row(s) deleted, ${removedFromData} data/ entr${removedFromData === 1 ? "y" : "ies"} removed, ${imported.length} imported, ${skipped.length} skipped, ${failed.length} failed.`);
  for (const s of skipped) console.log(`  skipped ${s}`);
  return failed.length ? 1 : 0;
}

// ---------- Command line ----------

const USAGE = `Usage:
  node server.js                 start the service
  node server.js --init <dir>    delete every stored file, import every file in <dir>, then exit`;

function parseArgs(argv) {
  let initDir = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      console.log(USAGE);
      process.exit(0);
    } else if (a === "--init") {
      initDir = argv[++i];
      if (!initDir || initDir.startsWith("--")) fail("--init needs a folder");
    } else if (a.startsWith("--init=")) {
      initDir = a.slice("--init=".length);
      if (!initDir) fail("--init needs a folder");
    } else {
      fail(`Unknown argument: ${a}`);
    }
  }
  return { initDir };
}

function fail(message) {
  console.error(message + "\n\n" + USAGE);
  process.exit(1);
}

const { initDir } = parseArgs(process.argv.slice(2));

if (initDir !== null) {
  // Init mode: no HTTP server. Do the work, then exit.
  runInit(initDir).then(
    (code) => process.exit(code),
    (err) => {
      console.error(`Init failed: ${err.message}`);
      console.error(initChangedStore
        ? "The store may be partly changed. Fix the problem and run --init again; it starts from a clean slate each time."
        : "Nothing was changed.");
      process.exit(1);
    }
  );
} else {
  server.listen(PORT, HOST, () => {
    console.log(`File store listening on http://${HOST}:${PORT}  (data: ${DATA_DIR})`);
    dab("/StoredFile?$first=1").then(
      () => console.log(`DAB reachable at ${DAB_URL.origin}`),
      (err) => console.warn(`WARNING: ${err.message}`)
    );
  });
}
