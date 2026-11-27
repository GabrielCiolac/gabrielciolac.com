FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
# Cloudflare caches .js for hours regardless of origin headers, so stamp each
# script reference with a hash of its contents: any change gets a new URL.
RUN cd /usr/share/nginx/html && \
    v=$(sha256sum room/logic.js | cut -c1-10) && \
    sed -i "s|src=\"room/logic.js\"|src=\"room/logic.js?v=$v\"|" index.html && \
    grep -q "room/logic.js?v=$v" index.html && \
    v=$(sha256sum room/win98.js | cut -c1-10) && \
    sed -i "s|src=\"room/win98.js\"|src=\"room/win98.js?v=$v\"|" index.html && \
    grep -q "room/win98.js?v=$v" index.html
