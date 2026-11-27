# gabrielciolac.com

Static site served from a home TrueNAS box.

**Pipeline:** merge to `main` → GitHub Actions builds an nginx image →
`ghcr.io/gabrielciolac/gabrielciolac.com:latest` → a cron job on the NAS
(`/root/bin/site-autodeploy`) pulls it and redeploys the
`gabrielciolac-site` TrueNAS app (host port 30080) → nginx-proxy-manager
terminates TLS for `gabrielciolac.com` / `www`.

The homepage is a point-and-click room: `site/index.html` (hotspots, puppet animation, overlays) plus painted layers in `site/room/`. Art sources and the generation scripts live outside the repo in `~/co/gabrielciolac-art/`.

**Time and weather:** the room swaps between four paintings (`room/room-{dawn,day,dusk,night}.webp`) using Toronto's sunrise and sunset, and the window shows live weather and temperature. A NAS cron job (`/root/bin/fetch-weather`, hourly at :03, source in `ops/fetch-weather.py`) writes Open-Meteo data to `/mnt/.ix-apps/app_mounts/gabrielciolac-site/data/weather.json`, which is bind-mounted read-only and served as `/data/weather.json`, so visitors never contact Open-Meteo themselves (the page only falls back to it if the file is missing). Add `#preview` to the URL to flip through every time of day, weather and temperature. The logic lives in `site/room/logic.js`.

**The computer:** clicking the desk computer opens a Windows 98-style desktop — teal background, taskbar, Start menu, a pixel Desk Wizard, and working Minesweeper and Solitaire. Game rules live in `site/room/win98.js` (loaded by the page and by the tests). Deep links for testing: `#desk`, `#desk-mines`, `#desk-sol`, `#desk-about`, `#desk-wizard`.

**Tests:** `node --test test/*.test.js` (room logic, game rules, page script, assets, no internal IPs) and `python3 -m unittest discover -s test -p 'test_*.py'` (deploy hook). CI runs both before building an image.

The NAS-side scripts are versioned in `ops/` (`deploy-hook.py`, `deploy-hook-run`, `site-autodeploy`, `fetch-weather.py`); copy them to `/root/bin/` on the NAS after changing them.

To make the mail table open an email, set `MAIL_TO` near the top of the script in `site/index.html`.

Edit `site/` to change the page. Preview locally:

```sh
docker build -t site . && docker run --rm -p 8080:80 --add-host deploy-hook:127.0.0.1 site
```

**Instant redeploys:** after pushing the image, CI sends an HMAC-signed `POST /__deploy`
(secret `DEPLOY_HOOK_SECRET`). nginx forwards it to `deploy-hook:30089`, a listener on the
NAS host that only accepts requests from the app's own Docker network and runs
`site-autodeploy`. An hourly cron is the fallback.
