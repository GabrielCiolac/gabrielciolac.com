# gabrielciolac.com

Static site served from a home TrueNAS box.

**Pipeline:** push to `main` → GitHub Actions builds an nginx image →
`ghcr.io/gabrielciolac/gabrielciolac.com:latest` → a cron job on the NAS
(`/root/bin/site-autodeploy`, every 2 min) pulls it and redeploys the
`gabrielciolac-site` TrueNAS app (host port 30080) → nginx-proxy-manager
terminates TLS for `gabrielciolac.com` / `www`.

Edit `site/` to change the page. Preview locally:

```sh
docker build -t site . && docker run --rm -p 8080:80 site
```
