# Gym Tracker

A personal workout tracker PWA — log sets, follow plans, chart progress, and track body metrics. All data stays in your browser (IndexedDB).

## Live app

After deployment, the app is available at:

**https://romanzdiarsky.github.io/gym-tracker/**

## Install on your phone

1. Open the live URL in Safari (iOS) or Chrome (Android).
2. Use **Add to Home Screen** / **Install app**.
3. Use the installed app at the gym — works offline after the first load.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (or your LAN IP on port 5173 for phone testing on the same Wi‑Fi).

## Build

```bash
npm run build
npm run preview
```

## Deploy

Pushes to `main` deploy automatically via GitHub Actions to GitHub Pages.

To enable Pages the first time: repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
