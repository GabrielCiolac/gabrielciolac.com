# gabrielciolac.com

Static site served from a home TrueNAS box.

**Pipeline:** merge to `main` → GitHub Actions builds an nginx image →
`ghcr.io/gabrielciolac/gabrielciolac.com:latest` → a cron job on the NAS
(`/root/bin/site-autodeploy`) pulls it and redeploys the
`gabrielciolac-site` TrueNAS app (host port 30080) → nginx-proxy-manager
terminates TLS for `gabrielciolac.com` / `www`.

The homepage is a point-and-click room: `site/index.html` (hotspots, puppet animation, overlays) plus painted layers in `site/room/`. Art sources and the generation scripts live outside the repo in `~/co/gabrielciolac-art/`.

To make the mail table open an email, set `MAIL_TO` near the top of the script in `site/index.html`.

Edit `site/` to change the page. Preview locally:

```sh
docker build -t site . && docker run --rm -p 8080:80 --add-host deploy-hook:127.0.0.1 site
```

**Instant redeploys:** after pushing the image, CI sends an HMAC-signed `POST /__deploy`
(secret `DEPLOY_HOOK_SECRET`). nginx forwards it to `deploy-hook:30089`, a listener on the
NAS host that only accepts requests from the app's own Docker network and runs
`site-autodeploy`. An hourly cron is the fallback.
