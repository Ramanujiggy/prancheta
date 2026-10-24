# Prancheta roadmap

Updated 2026-10-21. The product is built. What stands between it and the first sale is hosting, one real-iPhone pass, and the store.

## Top 3 next steps

1. **Settle the address before anyone uses the app for real.** Buy `prancheta.app` and move the app to `app.prancheta.app` before the first sale. A web app's saved classes belong to its address, so anything saved on the Railway test URL stays behind when the address changes. Host the app and site on Cloudflare Pages with a Netlify spare instead of Railway, which went down on 2026-10-20, 10-21 and 10-22 ([HOSTING.md](HOSTING.md)). A buyer who opens the receipt link during an outage asks for a refund.
2. **One iPhone test pass of everything since PR #8.** None of these has run on a real iPhone yet: making a clip, the class file, Teach mode with the phone locked, the folding editor, flexible blocks, the Rank icon on the home screen, and Plan with AI. Use the checklist below.
3. **Open the store.** Create the Lemon Squeezy store and the $10 product, set the receipt to give the app link, add `CHECKOUT_URL` and the support email to `site/index.html`, and add privacy, terms and refund pages. Lemon Squeezy reviews new stores, and those pages are what it looks for.

## Shipped (PRs #1 to #16, all merged)

| Area | What's in | PRs |
| --- | --- | --- |
| Class prep | Plan, time, teach with a round timer, print a sheet | #1 |
| Product | Installable offline app, pay once, no accounts or free tier | #3, #4 |
| Look | Clipboard style, night theme that follows the phone | #5 |
| Clips | Short videos made on the phone, a self-contained class file you can send | #6, #10 |
| Sturdiness | Phone sheets, safe saving, a timer that survives a locked phone | #8 |
| Name and language | Prancheta, English and Brazilian Portuguese in the app and on the sales page | #9 |
| Editor | One block at a time, optional parts as chips | #11 |
| Class format | Gym words for blocks; add, remove, repeat, rename and reorder blocks; five starting formats | #12, #13 |
| Copy and logo | Copy fixes in both languages, "The professor's clipboard", the Rank logo | #14 |
| Plan with AI | Copy or save the class format for your own AI chat, paste or open the answer | #15, #16 |
| Sales page | One page in `site/`, EN/PT switch, not yet deployed | #7, #9 |

63 tests pass on main.

## Phase 1: launch blockers

### Robert

- [ ] Buy `prancheta.app` (fallback `pranchetabjj.com`), at Cloudflare.
- [ ] Create Cloudflare and Netlify accounts and connect the repo (steps in [HOSTING.md](HOSTING.md)), and an UptimeRobot check.
- [ ] Open the Lemon Squeezy store, create the $10 product, confirm the 30-day refund.
- [ ] Set up the support inbox (`help@prancheta.app` is on the page now).
- [ ] Send the founder line: name, belt, gym, years teaching.
- [ ] Confirm "Luta" for the rolling block in Portuguese (it replaced "Rola" in #14).
- [ ] Have a Brazilian coach read the Portuguese app and sales page.
- [ ] Run the iPhone pass below and report what breaks.

### Claude, ready to start

- [ ] Retake the sales page screenshots. The ones in `site/img` date from PR #7, before the rename, the new blocks and the Rank logo, and the Portuguese page shows English screenshots.
- [ ] Add privacy, terms and refund pages to `site/`, in both languages.
- [ ] Make `og:image` an absolute URL once the domain is known, so links shared in WhatsApp and iMessage show a picture.
- [ ] Add a link to the site in the class file footer, so every class a coach sends tells the reader where it came from.
- [ ] Put the founder line on the sales page once Robert sends it.
- [x] Make the repo build on Cloudflare Pages and Netlify as well as Railway (HOSTING.md).
- [ ] Wire the domains once the accounts and domain exist.

### iPhone pass

1. Open the app link in Safari, Share, Add to Home Screen. Check the Rank icon.
2. New class, try each starting format, add, remove and reorder a block.
3. Make a 4-second clip from a video shot on the phone. It should save in seconds.
4. Teach mode: start a round, lock the phone for a minute, unlock. The timer should be right.
5. Send class file to yourself in Messages and open it. The clips should play.
6. Plan with AI: Save as file, drop it into a ChatGPT or Claude chat, paste the answer back.
7. Switch to Português and repeat steps 2 and 5.

## Phase 2: launch

- Soft launch to Robert's own gym and 10 to 20 coaches he knows. Watch for install trouble and refunds.
- Then the launch posts in the Launch Kit (Instagram, Reddit, BJJ forums, Brazilian groups).
- Measure: sales and refunds in Lemon Squeezy. If page traffic is wanted, add a cookie-free counter to the sales page only, so "nothing is collected" stays true for the app.

## Phase 3: after launch, driven by what coaches ask for

- **Ask AI to change this class**: export the current plan in the same format, so an AI can edit it and the app imports it back.
- **Remove the legacy plan copy** written for app versions before #13, one release after launch.
- **Install help**: if iPhone buyers struggle with Add to Home Screen, show the three steps on the receipt page and in the app's first screen.
- **A week of classes**: plan a series around one theme. Only if coaches ask.

## Risks to keep in view

- **Saved classes live on one device.** There is no account to restore from. Back up all classes and the class file are the only copies elsewhere, so the app should keep nudging coaches to back up.
- **The app link is not secret.** Anyone with it can use the app. Accepted at $10.
- **"Prancheta" is a common Portuguese word.** It's a strong name and a weak trademark. Register the logo with the name if it's ever registered.
- **Leftover "rola" in Portuguese.** Format descriptions and the Teach cue "Cumprimenta e rola" still use the verb. It's normal gym talk, but worth asking the Brazilian coach.

## Decisions already made

- $10 once, no free tier, trial, license key, gym pack or paid upgrades.
- No accounts. Classes stay on the device.
- The name is Prancheta alone, with no "BJJ" suffix.
- The logo is Rank. Clipboard is the New class icon and Round is the Teach icon.
- Storage keys stay `maestranada.*` so saved classes keep loading.
