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
3. Run `npm run setup` It downloads the toolchain (DAB + .NET runtime) into `.tools/` and creates `config/.env`.
4. Open `config/.env` and set both `DB_SERVER` and the `Server=` part of `DAB_CONN` for this computer (`localhost`, `localhost\SQLEXPRESS` or `(localdb)\MSSQLLocalDB`).  
5. Run `npm run schema` to (re)create the database from `db/schema/*.sql`  
6. Run `npm run data` to add data to your tables using scripts in `db/data/*.sql`  
7. Run `npm start` and leave that window open.  
8. Open this folder in VS Code (File > Open Folder) and click **Go Live** in the bottom-right status bar. It will open web/index.html in a browser.

Press Ctrl+C to stop DAB; Windows may ask "Terminate batch job (Y/N)?" Answer `Y`.

## HTTP access to your database
DAB exposes what are called [REST](https://www.geeksforgeeks.org/node-js/rest-api-introduction/) endpoints for your database tables. To understand the endpoints that you can use for your specific database tables, open this in your browser after doing the npm start:
http://localhost:5000/swagger


## HTTP access to file storage
This repo includes a small local service that can be used to store documents (e.g. images). The actual files are stored in the local filesystem but metadata about the file (filename, type, etc) are stored in a db table called StoredFile. Javascript in your locally hosted web app can "upload" files to this service, and you can download/display files that are in the service using the URL
http://localhost:3000/files/<UUID>

> Note: Do not remove StoredFile from the Entities in dab-config.json by accident.

## Working at home and at school
**Don't move the database. Move the scripts that rebuild it.**
- Adopt the mentality: *If it's not in Git, it doesn't exist*
- Everything lives in Git: `git add`, `git commit`, `git push` when you leave; `git pull` when you arrive.
- Changed the database? Put the change in a `.sql` file in `db/schema`.
- On each computer, run `npm run schema` `npm run data` after pulling to get the latest schema and sample data.
> **Note** `.env` is different for each computer and is not committed to git (but yeah, it needs to existon each computer you use)
- `npm run setup` is only needed once per computer.

## What's where
| Path | Purpose |
|---|---|
| `db/schema` | DDL scripts to create your database, tables, views... Scripts are executed in order so 01_ is before 02_ etc. You can add more SQL scripts if you want to separate out more configuration. |
| `db/data` | DML scripts to add initial data to your tables |
| `db/data/files` | Files (e.g. images) that will be seeded into the file store & database |
| `config/dab-config.json` | Tells DAB which database tables to expose and who may use them |
| `config/.env` | Database connection settings |
| `scripts/` | Windows scripts that are used by the npm commands |
| `web/` | Your front end: `index.html`, `app.js`, `style.css` etc. |
| `.vscode/` | Live Server settings (port 5500, serves `web/`) |

> **NOTE:** The database name for this project is set to "Project3D63W5". If you want to change this, then you must find all references in this repository's files and update all of them! The database name is in various scripts and configuration files.

## Exposing a new table
1. Add the table to a script in `db/schema` and run `npm run schema`.
2. Add an entry under `"entities"` in `config/dab-config.json`, copying the `dbo.Book` one. You can remove dbo.Book when you no longer need that as an example.
3. Restart `npm start`. The table is at `http://localhost:5000/api/<EntityName>`.

## Troubleshooting
- **`DAB did not start` / runtime errors:** `.tools/dab-tool/dotnet` must exist. Delete `.tools/` and run `npm run setup` again.
- **Login failed / cannot connect:** `DB_SERVER` and `Server=` in `config/.env` must match your SQL Server name. Check the instance name in SSMS's connection dialog.
- **Certificate error:** keep `TrustServerCertificate=True` in `DAB_CONN`.
- **Page says it can't reach DAB:** DAB must be running, and the page must be opened with Live Server (**Go Live**), not by double-clicking the file. If Live Server picks a different port, set `liveServer.settings.port` back to 5500, or add that origin to `cors.origins` in `config/dab-config.json`. Try `npm start` again.
- **Port 5000 busy:** close the other program, or start DAB with a different port and update `API` in `web/app.js` and the CORS origin if needed.
- **Table not found / 404:** the entity name in the URL is case-sensitive and must match `config/dab-config.json`.
