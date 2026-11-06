# DAB starter: a web front end for your SQL Server database

A browser page (HTML/JS/CSS) talks to **Data API Builder (DAB)**, which turns your SQL Server tables into a REST API. You write no back-end code.

```
Browser (web/)  --fetch-->  DAB (http://localhost:5000)  --SQL-->  SQL Server  (managed with SSMS)
```

## Before you start (once per computer)
- SQL Server (Developer, Express or LocalDB) and SSMS installed
- Git
- VS Code with the **Live Server** extension (VS Code will offer to install it when you open this folder)

## Student setup
1. Clone this repo and open a terminal in its folder.
2. Run `setup.bat`. It downloads the toolchain (DAB + .NET runtime) into `.tools/` and creates `.env`.
3. Open `.env` and set `DB_SERVER` and the `Server=` part of `DAB_CONN` for this computer (`localhost`, `localhost\SQLEXPRESS` or `(localdb)\MSSQLLocalDB`).
4. Run `rebuild-db.bat` to create the database from `db/*.sql`. (No `sqlcmd`? Run `db/01_schema.sql` then `db/02_seed.sql` in SSMS.)
5. Run `run.bat` and leave that window open. Check http://localhost:5000/api/Student shows JSON.
6. Open this folder in VS Code (File > Open Folder) and click **Go Live** in the bottom-right status bar. The page opens at http://127.0.0.1:5500.

### Optional: npm shortcuts
If you have Node/npm installed, these run the same scripts (Windows only):

| Command | Runs |
|---|---|
| `npm run setup` | `setup.bat` |
| `npm run db:rebuild` | `rebuild-db.bat` |
| `npm start` (or `npm run dab`) | `run.bat` |

Press Ctrl+C to stop DAB; Windows may ask "Terminate batch job (Y/N)?" Answer `Y`.

## Working at home and at school
**Don't move the database. Move the scripts that rebuild it.**
- Everything lives in Git: `git add`, `git commit`, `git push` when you leave; `git pull` when you arrive.
- Changed the database? Put the change in a `.sql` file in `db/`. **If it isn't in a .sql file in the repo, it doesn't exist.**
- On each computer, run `rebuild-db.bat` after pulling to get the latest schema and sample data.
- `.env` is different on each computer and is never committed.
- `setup.bat` is only needed once per computer (or per folder, if the lab wipes your files).

## What's where
| Path | Purpose |
|---|---|
| `db/` | Numbered SQL scripts: schema, seed data. Scripts are re-runnable. |
| `dab-config.json` | Tells DAB which tables to expose and who may use them |
| `web/` | Your front end: `index.html`, `app.js`, `style.css` |
| `.env` | This computer's connection string (git-ignored) |
| `setup.bat` / `run.bat` / `rebuild-db.bat` | Helpers |
| `.vscode/` | Live Server settings (port 5500, serves `web/`) |

## Exposing a new table
1. Add the table to a script in `db/` and run `rebuild-db.bat`.
2. Add an entry under `"entities"` in `dab-config.json`, copying the `Student` one.
3. Restart `run.bat`. The table is at `http://localhost:5000/api/<EntityName>`.

Handy while developing: `/swagger` (try the REST API in the browser) and `/graphql` (query explorer). REST also supports `?$filter=`, `$orderby` and `$first`.

REST cheat sheet (for entity `Student`, key `StudentId`):

| Action | Request |
|---|---|
| List | `GET /api/Student` |
| One | `GET /api/Student/StudentId/5` |
| Create | `POST /api/Student` with JSON body |
| Update | `PATCH /api/Student/StudentId/5` with the changed fields |
| Delete | `DELETE /api/Student/StudentId/5` |

## Ideas to extend
- Add a second table (e.g. `Course`) and a foreign key; show both on the page.
- Sort and filter the list with `?$orderby=` and `?$filter=`.
- Validate input and show friendly error messages.
- Use a stored procedure or view (views need `key-fields` in the config).
- Restrict permissions: make an entity read-only (`"actions": ["read"]`).

## Troubleshooting
- **`DAB did not start` / runtime errors:** `.tools\dab-tool\dotnet` must exist. Delete `.tools/` and run `setup.bat` again.
- **Login failed / cannot connect:** `DB_SERVER` and `Server=` in `.env` must match your SQL Server name. Check the instance name in SSMS's connection dialog.
- **Certificate error:** keep `TrustServerCertificate=True` in `DAB_CONN`.
- **Page says it can't reach DAB:** `run.bat` must be running, and the page must be opened with Live Server (**Go Live**), not by double-clicking the file. If Live Server picks a different port, set `liveServer.settings.port` back to 5500, or add that origin to `cors.origins` in `dab-config.json`.
- **Port 5000 busy:** close the other program, or start DAB with a different port and update `API` in `web/app.js` and the CORS origin if needed.
- **Table not found / 404:** the entity name in the URL is case-sensitive and must match `dab-config.json`.

---

## Instructor notes
1. On a machine with the .NET SDK, run `instructor\build-toolchain.bat`. It produces `toolchain.zip` (portable DAB plus the ASP.NET Core 10.0 runtime, x64 Windows) and prints its SHA-256.
2. Upload `toolchain.zip` as a GitHub **Release** asset (no LFS needed) or to a school share.
3. In `setup.bat`, set `TOOLCHAIN_URL` (and optionally `TOOLCHAIN_SHA256`). If github.com is blocked in the lab, students can instead drop `toolchain.zip` next to `setup.bat`; the script uses it if present.
4. The build script pins `DAB_VERSION` and `DOTNET_CHANNEL` at the top. DAB 2.x targets .NET 10; if you change the DAB version, make sure the `tools\netNN.0` path in the printed shim matches the channel.
5. Publish this as a GitHub template repo (or a Classroom assignment) so each student gets a copy.
6. Lab images must provide SQL Server/LocalDB and SSMS, and students need permission to create databases.
