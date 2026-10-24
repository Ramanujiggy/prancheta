# Prancheta

The perfect Jiu-Jitsu class prep tool.

A class is made of blocks: **Warm-up**, **Concept**, **Positional sparring**, **Technique**, **Rolling**, and an optional **Wrap-up**. Coaches can add, remove, repeat, rename and reorder them, or start from one of five formats (Game first, Technique first, Open mat, Drilling day, Comp prep).

The app lets a coach build a plan, see how long the class runs, teach it from a phone or tablet with a round timer, add short technique clips, send the whole class as one file, plan it with their own AI chat, and print a one-page class sheet. It runs in English and Brazilian Portuguese.

What's next is in [ROADMAP.md](ROADMAP.md).

## Run it

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run test:run   # unit tests
npm run build      # static build in app/dist
```

## Deploy

The app is static files, so any static host works. The recommended setup (Cloudflare Pages, with a Netlify spare, behind the `prancheta.app` domain) and what an outage means for buyers are in [HOSTING.md](HOSTING.md).

- **Cloudflare Pages:** Root directory empty, build command `npm run build`, output `app/dist`.
- **Netlify:** reads `netlify.toml`.
- **Railway:** leave the Root Directory empty. The root `railway.toml` and `package.json` build `app/` and serve it on Railway's `PORT`.

Plans are saved in the browser's local storage on the device they were made on. Back up all classes, or send a class file, to move them between devices.

## Install and offline

The app is a Progressive Web App. After the first visit it works with no connection (app, fonts and icons are all cached). On Chrome, Edge and Android it shows an **Install app** button; on iPhone and iPad, use Share → Add to Home Screen. New versions show an **Update** prompt.

## Selling it (pay once, download, it works)

There is no free tier, no account and no license key. A buyer pays once and gets the app.

1. Create a $10 product in Lemon Squeezy.
2. Set the purchase to deliver the app link (`https://app.prancheta.app`, never a host's own URL; see [HOSTING.md](HOSTING.md)) in the receipt page and email. The same link is the install for every device:
   - **Laptop:** Chrome or Edge show an **Install app** button. Safari on a Mac uses File → Add to Dock.
   - **iPhone / iPad:** Share → Add to Home Screen.
   - **Android:** the **Install app** button.
3. Once installed it opens like any other app and runs offline. Every deploy reaches every buyer as an update.

Plans stay on the buyer's device. Nothing about them is collected; the checkout keeps the buyer's email for the receipt.

The app link itself is not secret: anyone who has it can open the app. At $10 that trade-off keeps delivery simple.
