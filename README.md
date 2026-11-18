# NextS4HANA

Leads CRM for NextS4HANA: dashboard, leads, payments and user management.
Plain static site: **HTML + CSS + JavaScript**, no framework and no runtime dependencies.

## Structure

```
NextS4Hana/
├── index.html                  Page structure
├── src/
│   ├── styles/main.css         All styling, themes, responsive layout
│   └── scripts/
│       ├── theme-init.js       Applies saved light/dark theme before first paint
│       ├── runtime-shim.js     Storage fallback outside claude.ai (see below)
│       └── app.js              Application logic
├── public/
│   ├── images/                 Logo, favicon, apple-touch-icon
│   └── icons/                  search.svg
├── scripts/
│   ├── build.mjs               Copies the site into dist/ (used by Vercel)
│   └── dev-server.mjs          Local static server
├── package.json
├── vercel.json
└── .gitignore
```

External resources loaded from CDNs: SheetJS (cdnjs) for Excel import/export, and Google Fonts
(Plus Jakarta Sans, IBM Plex Sans). The internet is needed for those.

## Run locally

Requires Node.js 18+. There is nothing to install.

```bash
npm run dev        # http://localhost:3000
```

(Any static server works too, e.g. `python3 -m http.server 3000`.)

## Deploy

**GitHub:** create a repository and upload/push the contents of this folder
(`index.html` must be at the repository root).

**Vercel:** Add New → Project → import the repository, then deploy with the defaults.
`vercel.json` already sets the build command (`npm run build`) and output directory (`dist`).
The app uses `#hash` routes (`/#leads`, `/#payments`), so refresh and direct links work without rewrites.

## Important: data storage

The app was built inside Claude and originally saved data (leads, users, login, settings, activity)
in Claude's shared artifact database. That does not exist on GitHub/Vercel, so when it is missing,
`src/scripts/runtime-shim.js` stores data in the **browser's localStorage** instead. That means:

- Data lives only in the browser/device where it was entered. It is **not shared** between users or devices.
- Clearing browser data erases it. Use the app's CSV/Excel export for backups.
- Sign-in, roles and password checks run in the browser, so they are not real security
  for sensitive data on a public site.
- Emails that the app sent through Claude's Gmail connection fall back to opening a Gmail compose window.

To use this as a real shared multi-user CRM, replace the `db` object in `runtime-shim.js` with a
hosted backend (for example Supabase or Firebase). The app only uses `doc(path).get/set/update`,
`collection(name).add` and `collection(name).onSnapshot`.
On claude.ai the real runtime is present and the shim does nothing.
