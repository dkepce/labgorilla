# LabGorilla

A lab notebook for experiments, protocols, inventory and planning. Plain HTML/CSS/JS, **no build step** — these files are the app. Installable (PWA), works offline.

## Run it locally
```
python -m http.server 8123
```
Open http://localhost:8123 in Chrome/Edge/Brave (the install/offline parts need a web address, not a double-click).

## Where the data lives
* Always in the browser (localStorage + IndexedDB for attachments).
* Optionally in a folder she picks (top bar → "Saved in this browser" → Choose folder): every change is written to `LabGorilla.lbk`, attachments go to `LabGorilla files/` next to it. Needs the File System Access API (Chrome/Edge; in Brave enable it in `brave://flags`).
* Backup / Restore buttons in the same dialog; "Load example data" fills in a demo.

## Files
| File | What it does |
|---|---|
| `index.html`, `style.css` | page + styles (colors are CSS variables, swapped by the Colors picker) |
| `js/util.js` | dates, ids, small helpers |
| `js/store.js` | data model, autosave, `.lbk` file + folder sync, attachments |
| `js/app.js` | render loop, event handling, top bar, dialogs, themes, `#/entry/<code>` links |
| `js/items.js` | pieces shared by Notebook and Inventory (attachments, supplier details, new material) |
| `js/notebook.js` `protocols.js` `inventory.js` `calendar.js` | the four tabs |
| `js/seed.js` | example data |
| `sw.js`, `manifest.webmanifest`, `icons/` | offline + install |

## Links from other apps
`<address>#/entry/<entry code or id>` opens that entry, `<address>#/calendar/YYYY-MM-DD` opens the calendar on that day (Hedgehog uses these).

## `.lbk` file format
JSON: `{ app: "labgorilla", version: 1, saved, settings, data }` where `data` has `projects, experiments, entries, protocols, items, types, events`.
