# ChatGPT Cheat Sheet: landing page and lead CRM

Code Academy's lead magnet. Visitors leave their name, email and phone on the landing page and get the free "ChatGPT Cheat Sheet 2026" PDF. Leads go into a Google Sheet, and a small CRM dashboard tracks them.

## How it fits together

```
Browser ──POST JSON──▶ Google Apps Script web app ──▶ Google Sheet ("Leads")
   │                         │
   │                         ├─▶ Welcome email with the PDF link (Gmail / MailApp)
   │                         └─▶ CRM dashboard (Admin.html, served by Apps Script)
   │
   └── index.html + og-image.png: a static site, the only part hosted on our server
```

**Only two files go on our server: `index.html` and `og-image.png`.** The site is static: no backend, database, build step or Node/PHP runtime. Form submissions go straight from the visitor's browser to Google Apps Script, which handles storage, email and the CRM.

| File | Where it runs |
|---|---|
| `index.html` | Our web server (static) |
| `og-image.png` | Our web server (static), the link-preview image for social networks |
| `Code.gs` | Google Apps Script, bound to the leads Google Sheet |
| `Admin.html` | Google Apps Script (CRM dashboard). **Do not deploy it to the web server.** |
| `QURAŞDIRMA.md` | Step-by-step Google-side setup (in Azerbaijani) |
| `deploy/` | nginx config and Dockerfile for the static site |

## Deploying the static site

### Before deploying: fill in the config

At the top of `index.html` there is a `window.CONFIG` block. The project owner fills it in after the Google-side setup (`QURAŞDIRMA.md`, steps 1–4):

```js
SCRIPT_URL: "https://script.google.com/macros/s/<id>/exec",  // required, or the form runs in demo mode
PDF_URL: "",          // optional fallback; the script normally returns the link
CONTACT_EMAIL: "",    // shown in the Terms
GA4_ID: "",           // optional
META_PIXEL_ID: ""     // optional
```

While `SCRIPT_URL` is empty, the page shows a yellow "Demo rejim" banner and saves nothing.

After the final URL is known, also change the `og:image` meta tag in `index.html` to an absolute URL, for example `https://code.edu.az/chatgpt/og-image.png`. Social networks ignore relative image paths.

### Option A: existing nginx

Copy `index.html` and `og-image.png` into a web root (for example `/var/www/chatgpt`) and add a location block. A complete example is in [`deploy/nginx.conf`](deploy/nginx.conf). For a sub-path on an existing site:

```nginx
location /chatgpt/ {
    alias /var/www/chatgpt/;
    index index.html;
    add_header Cache-Control "no-cache";
}
```

HTTPS is required: browsers block form submissions to Google from an insecure page in some cases, and ad platforms expect HTTPS.

### Option B: Docker

```bash
docker build -f deploy/Dockerfile -t chatgpt-landing .
docker run -d --name chatgpt-landing -p 8080:80 --restart unless-stopped chatgpt-landing
```

The image is `nginx:alpine` with only the two public files. Put it behind the existing reverse proxy / TLS terminator.

### Requirements and notes

- **Outbound from the visitor's browser** (not the server) to `script.google.com`, `script.googleusercontent.com`, `fonts.googleapis.com` and `fonts.gstatic.com`. If you set a Content-Security-Policy header, allow these (plus `www.googletagmanager.com` / `connect.facebook.net` if analytics IDs are set). `deploy/nginx.conf` contains a matching CSP.
- **Caching:** `index.html` should be `no-cache` so config changes take effect immediately. `og-image.png` can be cached.
- **No server-side secrets** exist in this repo. Lead data never touches our server; it lives in the Google Sheet owned by the account that deployed the Apps Script.
- **Updating:** replace `index.html` and reload. No restart is needed with plain nginx; with Docker, rebuild the image.

### Smoke test after deploy

1. Open the page on a phone. There should be no yellow "Demo rejim" banner.
2. Submit the form with real data. A success screen with a "PDF-i yüklə" button should appear.
3. Check that a new row appeared in the Google Sheet and that the welcome email arrived.
4. Delete the test row from the sheet.

## Previewing locally

```bash
python3 -m http.server 8765
# http://127.0.0.1:8765/index.html  - landing page (demo mode)
# http://127.0.0.1:8765/Admin.html  - CRM dashboard with sample data (demo mode)
```

## Google-side setup (project owner)

Covered in [`QURAŞDIRMA.md`](QURAŞDIRMA.md): creating the sheet, pasting `Code.gs` and `Admin.html` into Apps Script, deploying the web app, and getting the private CRM dashboard link.
