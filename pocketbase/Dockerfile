# PocketBase for the guestbook. The release zip is pinned and checked against its published SHA-256.
FROM alpine:3.20
ARG PB_VERSION=0.40.6
ARG PB_SHA256=0e1f609158ed945f809f8a02ae012aa0427129c66ebb63c1aee76f2c0309373f
RUN apk add --no-cache ca-certificates unzip wget \
 && wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
 && echo "${PB_SHA256}  /tmp/pb.zip" | sha256sum -c - \
 && unzip -q /tmp/pb.zip -d /pb && rm /tmp/pb.zip && apk del unzip wget \
 && adduser -D -H -u 10001 pb && mkdir -p /pb/pb_data && chown pb /pb/pb_data
COPY pb_migrations /pb/pb_migrations
COPY pb_hooks /pb/pb_hooks
USER pb
EXPOSE 8090
VOLUME /pb/pb_data
CMD ["/pb/pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data", "--migrationsDir=/pb/pb_migrations", "--hooksDir=/pb/pb_hooks"]
