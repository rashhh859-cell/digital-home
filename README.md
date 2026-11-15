# My Digital Home 🐾

A cozy pixel-art desktop for the G-TiDE H1 tablet (Android 11, 1280×800).
Plain HTML + CSS + JavaScript — no frameworks, no build step.

## Files
| File | What it does |
|---|---|
| `index.html` | The page layout (widgets, sidebar, top bar) |
| `style.css` | All the colours, sizes and animations |
| `script.js` | Everything interactive: room drawing, Kuro, garden, planner, notes, music, weather, apps |
| `manifest.json` | Makes it installable as an app (name, icon, fullscreen, landscape) |
| `service-worker.js` | Saves the app on the tablet so it opens offline |
| `offline.html` | Shown only if the app was never loaded online |
| `assets/` | App icons |

## 1. Test it on your computer
Opening `index.html` by double-clicking mostly works, but offline mode and location need a tiny local server:

1. Install Python (python.org) if you don't have it.
2. Open a terminal in this folder and run: `python -m http.server 8000`
3. Visit http://localhost:8000 in Chrome.
4. Press F12 → click the phone/tablet icon → set the size to 1280 × 800 to see the tablet view.

(VS Code's "Live Server" extension works too.)

## 2. Publish free with GitHub Pages
1. Make a free account at github.com.
2. Click **+ → New repository**. Name it `digital-home`, set it **Public**, click **Create repository**.
3. Click **uploading an existing file**, drag in *all* the files and the `assets` folder, then **Commit changes**.
4. Go to **Settings → Pages**. Under *Branch* choose `main` and `/ (root)`, click **Save**.
5. Wait about a minute. Your app is at `https://YOUR-USERNAME.github.io/digital-home/`

## 3. Install it on the tablet
1. On the tablet, open **Chrome** and go to your GitHub Pages address.
2. Wait a few seconds for it to load fully (this saves it for offline use).
3. Tap the **⋮ menu → Install app** (or **Add to Home screen → Install**).
4. Open **Digital Home** from the home screen. It runs fullscreen, in landscape, like a normal app.
5. Optional: in the app go to **Settings → Keep screen awake** to use it as an always-on dashboard while charging.

## Updating the app later
1. Edit the files and upload them to the same GitHub repository again.
2. In `service-worker.js`, change `const CACHE = 'mdh-v1'` to `'mdh-v2'` (then v3, v4…).
3. Open the app on the tablet twice; the second time you'll get the new version.

## Customising app shortcuts
The sidebar apps are listed in `script.js` under `const APPS`. Each one has an Android
package name (`pkg`) and a website fallback (`url`). If the app is installed, it opens;
if not, the website opens instead.

## Your data
Tasks, notes, Kuro, the garden and settings live in the browser's storage on the tablet.
Use **Settings → Back up** now and then. Clearing Chrome's site data will erase them.
