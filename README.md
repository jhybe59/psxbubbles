# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


## Backup & Restore

This project includes simple local backup and restore scripts to create a ZIP snapshot of the repository (including the `.git` folder) so you can restore a previous state if the repo becomes damaged.

- Backups are stored outside the repository folder (one level up) in a folder named `<projectname>_backups` (e.g. `my-cryptobubbles_backups`). This helps them survive repository-level deletes.
- To create a backup:

```powershell
npm install          # install new dependencies (archiver, adm-zip)
npm run backup       # creates a timestamped zip backup
```

- To restore a backup:

```powershell
npm run restore              # interactive list to choose a backup
# or
npm run restore <filename>   # restore a specific backup filename
```

Notes:
- The restore script will prompt for confirmation and will overwrite files in the current directory.
- Backups exclude `node_modules` by default to keep archives small.

If you'd like remote/offsite backups (recommended for extra safety), I can add optional upload to S3, Dropbox, or another provider.

Logo migration (data-URI -> repo assets)
---------------------------------------

If you used the Symbols Panel to upload logos they are stored in localStorage as data-URIs. To extract those images into repo files (so they're available from `public/assets/logos/` and not kept in localStorage), you can:

1. In the app open Symbols Panel and click Export to save `symbol-metadata.json`.
2. From the project root run:

```powershell
npm run migrate-logos -- symbol-metadata.json
```

3. The script will create `public/assets/logos/` and write extracted image files, and output `public/assets/migrated_symbol_metadata.json` with updated `image` paths (e.g. `/assets/logos/ABC.svg`).
4. You can then import the migrated JSON back into the Symbols Panel (Import) or copy the file into your deployment process so the app uses the repo-hosted SVGs.

Note: the script only processes data-URI images (it will leave existing URLs untouched). After migration you may want to clear large data-URIs from localStorage to save space.

Admin server & Backup panel
--------------------------

This project now includes a small local admin server that exposes backup/restore endpoints and a front-end panel to control backups from the app UI.

1. Install dependencies (if you haven't already):

```powershell
npm install
```

2. Start the admin server (separate terminal):

```powershell
npm run start-admin
```

By default the admin server listens on http://localhost:4001 and stores backups in the folder one level up from the repo named `<projectname>_backups`.

3. Start the app (dev server):

```powershell
npm run dev
```

4. Open the app in your browser (Vite will show the URL). Use the floating "Backups" button (bottom-right) to open the Backup & Restore panel. The panel will call the admin server at `/api/*` endpoints (dev setup proxies requests to the same origin when you run both servers locally).

Notes:
- The admin server must be running for the UI panel to function.
- The restore operation creates a pre-restore safety snapshot before extracting the backup.
