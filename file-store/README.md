# file-store

A small file storage service. File bytes are kept on disk in `data/<id>`; file metadata (name, type, size, timestamp) is kept in SQL Server, reached through Data API Builder (DAB). SQL Server generates each file's id (a GUID) and creation time.

```
client --HTTP--> file-store (127.0.0.1:3000) --REST--> DAB (127.0.0.1:5000) --SQL--> SQL Server
                       |
                       +--> data/<id>   (file bytes)
```

## Setup
1. Run `file-store.sql` in SSMS. It creates the `FileStore` database and `dbo.StoredFile` table, and can be re-run safely.
2. Set the DAB connection string for this database, e.g.
   `set "DAB_CONN=Server=YOURSERVER;Database=FileStore;Trusted_Connection=True;TrustServerCertificate=True;"`
3. Start DAB, bound to loopback only:
   ```bat
   set "ASPNETCORE_URLS=http://127.0.0.1:5000"
   dab start --config dab-config.file-store.json
   ```
   Already running another DAB on port 5000? Use another port here (e.g. 5001) and set `DAB_URL` below to match. To merge instead, copy the `StoredFile` entity into your existing config; both entities then share one connection string and database.
4. Start the service: `node server.js` (Node 18+, no `npm install`). It prints a warning at startup if it can't reach DAB.

## Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | Port for file-store |
| `DAB_URL` | `http://127.0.0.1:5000/api` | DAB's REST base URL. Use `127.0.0.1`, not `localhost` |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:5500,http://localhost:5500` | Browser pages allowed to call this API (comma-separated). Add your Live Server origin if it differs |

The bind address is fixed to `127.0.0.1` in the code on purpose.

## Reset and import: `--init <dir>`
```bat
node server.js --init C:\path\to\seed-files
```
Wipes the store and fills it from a folder, then **exits** (it does not start the web service; start it again with `node server.js`). **Stop the running service first.** Nothing stops two copies working on `data/` at once.

1. Reads `<dir>` (a flat folder). Subfolders, non-regular files, empty files and files over 10 MB are skipped and listed in the summary.
2. Lists everything DAB knows about and deletes each row, then **empties `data/` completely** (stored files, `.json` files from older versions, strays, subfolders), so files left over from a dropped or recreated table are cleaned out too. The `data` folder itself stays. `<dir>` must not be the data folder or inside it.
3. For each file in `<dir>` (alphabetical order), registers its metadata in DAB, which generates the id, then **copies** the file to `data/<id>` with the filesystem (no streaming). The content type comes from the file extension (unknown extensions become `application/octet-stream`), and the filename is the file's name.

Safety: the folder is checked and DAB is contacted *before* anything is deleted, so a typo or a stopped DAB changes nothing ("Nothing was changed."). If a failure happens later, the store may be partly changed; fix the problem and run `--init` again, since it always starts from a clean slate. A file that can't be imported is reported and the rest continue; the exit code is `1` if any file failed or the run was aborted, otherwise `0`.

## Local-only checklist
```bat
netstat -ano | findstr :3000
netstat -ano | findstr :5000
```
Both should show `127.0.0.1` (or `[::1]`), never `0.0.0.0` or `[::]`. In addition, file-store refuses requests whose `Host` header isn't a loopback name and any browser request whose `Origin` isn't in `ALLOWED_ORIGINS`. DAB is configured with no CORS origins, no GraphQL, and only `create`, `read` and `delete` on `StoredFile`.

## API (unchanged for clients)
| Request | Result |
|---|---|
| `GET /files` | `200` JSON array, newest first |
| `POST /files?filename=a.png` | `201 { id, filename, contentType, size, createdAt, url }`; body = raw file; `413` over 10 MB; `400` if empty |
| `GET /files/:id` (or `HEAD`) | the file; `404` if unknown |
| `DELETE /files/:id` | `204`; `404` if unknown |
| any, if DAB is down or errors | `502` |

## What file-store asks DAB to do
| When | DAB request |
|---|---|
| Upload (after the bytes are saved to a temp file) | `POST /api/StoredFile` `{ Filename, ContentType, Size }` |
| Upload fails after the row was created | `DELETE /api/StoredFile/Id/{id}` |
| List | `GET /api/StoredFile?$orderby=CreatedAt%20desc&$first=-1`, following `nextLink` |
| Download / HEAD / confirming an upload | `GET /api/StoredFile/Id/{id}` |
| Delete | `DELETE /api/StoredFile/Id/{id}`, then the file is removed from disk |

## Notes
- **Existing files.** Files stored by the previous version (`data/<id>` plus `data/<id>.json`) are not in the database, so they won't be listed or served, and the old `.json` files are ignored. `--init` deletes them along with everything else in `data/`, so to keep any of them, copy them into a folder under their real names first and import that folder.
- **Orphans.** If the process dies between "row created" and "file renamed", a row can point to a missing file (downloads return 404), and deleting that row cleans it up. Leftover `.tmp` files are deleted at startup.
- **Debugging.** DAB's development mode serves `/swagger`, handy for trying the requests above by hand.
