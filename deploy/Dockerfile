# Build from the repo root:  docker build -f deploy/Dockerfile -t chatgpt-landing .
FROM nginx:1.27-alpine
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx.conf /etc/nginx/conf.d/site.conf
COPY deploy/security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY index.html abune.html og-image.png /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
