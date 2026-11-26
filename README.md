# gabrielciolac.com

Static site served from a home TrueNAS box.

**Pipeline:** push to `main` → GitHub Actions builds an nginx image →
`ghcr.io/gabrielciolac/gabrielciolac.com:latest` → a cron job on the NAS
(`/root/bin/site-autodeploy`, every 2 min) pulls it and redeploys the
`gabrielciolac-site` TrueNAS app (host port 30080) → nginx-proxy-manager
terminates TLS for `gabrielciolac.com` / `www`.

The homepage is a point-and-click room: `site/index.html` (hotspots, puppet animation, overlays) plus painted layers in `site/room/`. Art sources and the generation scripts live outside the repo in `~/co/gabrielciolac-art/`.

To make the mail table open an email, set `MAIL_TO` near the top of the script in `site/index.html`.

Edit `site/` to change the page. Preview locally:

```sh
docker build -t site . && docker run --rm -p 8080:80 site
```
