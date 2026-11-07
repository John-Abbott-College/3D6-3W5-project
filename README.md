# A web front end for your SQL Server database

A browser page (HTML/JS/CSS) talks to **Data API Builder (DAB)**, which turns your SQL Server tables into a REST API. You write no back-end code.

```
Browser (web/)  --fetch-->  DAB (http://localhost:5000)  --SQL-->  SQL Server  (managed with SSMS)
```

## Before you start (once per computer)
- SQL Server (Developer, Express or LocalDB) and SSMS installed
- Git
- VS Code with the **Live Server** extension (VS Code will offer to install it when you open this folder)
- npm

## Initial setup
1. Clone this repo and open a terminal in its folder.
2. Run `npm install`
3. Run `npm run setup` It downloads the toolchain (DAB + .NET runtime) into `.tools/` and creates `.env`.
4. Open `.env` and set both `DB_SERVER` and the `Server=` part of `DAB_CONN` for this computer (`localhost`, `localhost\SQLEXPRESS` or `(localdb)\MSSQLLocalDB`).
5. Run `npm run db` to (re)create the database from `db/*.sql`
6. Run `npm start` and leave that window open.
7. Open this folder in VS Code (File > Open Folder) and click **Go Live** in the bottom-right status bar. It will open web/index.html in a browser.

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
- Adopt the mentality: *If it's not in Git, it doesn't exist*
- Everything lives in Git: `git add`, `git commit`, `git push` when you leave; `git pull` when you arrive.
- Changed the database? Put the change in a `.sql` file in `db/`.
- On each computer, run `npm run db` after pulling to get the latest schema and sample data.
> **Note** `.env` is different for each computer and is not committed to git (but yeah, it needs to existon each computer you use)
- `npm run setup` is only needed once per computer.

## What's where
| Path | Purpose |
|---|---|
| `db/` | Numbered SQL scripts: schema, seed data. Scripts are executed in order so 01_ is before 02_ etc. You can add more SQL scripts if you want to separate out more configuration. |
| `dab-config.json` | Tells DAB which database tables to expose and who may use them |
| `web/` | Your front end: `index.html`, `app.js`, `style.css` etc. |
| `.env` | This computer's connection string (git-ignored) |
| `setup.bat` / `run.bat` / `rebuild-db.bat` | Helper scripts. You can run them directlt, or via the npm commands. |
| `.vscode/` | Live Server settings (port 5500, serves `web/`) |

## Exposing a new table
1. Add the table to a script in `db/` and run `npm run db`.
2. Add an entry under `"entities"` in `dab-config.json`, copying the `dbo.Book` one. You can remove dbo.Book when you no longer need that as an example.
3. Restart `npm start`. The table is at `http://localhost:5000/api/<EntityName>`.

## HTTP access to your database
DAB exposes what are called [REST](https://www.geeksforgeeks.org/node-js/rest-api-introduction/) endpoints for your database tables. To understand the endpoints that you can use, view the generated Swagger documentation by opening this in your browser:
http://localhost:5000/swagger

REST also supports `?$filter=`, `$orderby` and `$first`.

REST cheat sheet (for entity `Book`, key `BookId`):

| Action | Request |
|---|---|
| List | `GET /api/Book` |
| One | `GET /api/Book/BookId/2` |
| Create | `POST /api/Book` with JSON body |
| Update | `PATCH /api/Book/BookId/2` with the changed fields |
| Delete | `DELETE /api/Book/BookId/2` |

## Ideas to extend
- Add a second table (e.g. `Authors`) and a foreign key; show both on the page.
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
