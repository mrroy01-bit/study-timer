# Study Focus Timer — Chrome Extension

Track study sessions, focus score, and VS Code switches right from your browser toolbar.

---

## Folder structure

```
study-timer/
├── manifest.json      ← Extension config (Manifest V3)
├── index.html         ← Popup UI (HTML structure)
├── style.css          ← All styles
├── app.js             ← All logic (timer, focus score, VS Code detection)
├── background.js      ← Service worker (alarms, notifications, badge)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── fonts/             ← (optional) local .woff2 font files
    ├── SpaceMono-Regular.woff2
    ├── SpaceMono-Bold.woff2
    ├── DMSans-Regular.woff2
    └── DMSans-Bold.woff2
```

---

## How to install in Chrome

1. Open Chrome and go to: `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `study-timer/` folder
5. The timer icon appears in your toolbar — click it to open!

---

## Icons

You need PNG icons at 4 sizes: 16, 32, 48, 128 px.
- Place them in an `icons/` subfolder
- Simple free option: use any online favicon generator and export all 4 sizes

---

## Fonts (optional)

Chrome extensions cannot load fonts from Google CDN.
The extension will fall back to system monospace / sans-serif fonts if no local fonts are found.

To use the original fonts:
1. Download **Space Mono** and **DM Sans** `.woff2` files from Google Fonts
2. Place them in a `fonts/` subfolder (see structure above)

---

## Features

| Feature | Detail |
|---|---|
| Study modes | Pomodoro 25m, Deep 45m, 1 Hour, 2 Hours, Free |
| Coding modes | Code 1h, Code 2h, Code Free |
| VS Code detection | Detects browser blur — shown as badge, does NOT hurt score |
| Focus score | 0–100 per session based on distractions |
| Notifications | Desktop alert when session timer completes |
| Badge | Shows ON while running; shows remaining minutes each minute |
| Persistence | Sessions saved via `chrome.storage.local` across popup closes |
| Session log | Last 10 sessions with subject, time, score, VS Code tag |
