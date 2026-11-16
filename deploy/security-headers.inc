# Security headers for index.html. The CSP allows exactly what the page uses:
# inline config/script, Google Fonts, the Apps Script endpoint, and optional GA4 / Meta Pixel.
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://www.google-analytics.com https://www.facebook.com; connect-src https://script.google.com https://script.googleusercontent.com https://*.google-analytics.com https://*.analytics.google.com https://www.facebook.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" always;
