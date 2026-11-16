/**
 * Code Academy · E-poçt xidməti (Gmail API)
 *
 * - Məktubları Gmail API ilə göndərir (Apps Script-də «Services → Gmail API» qoşulmalıdır).
 *   Qoşulmayıbsa, avtomatik MailApp-a keçir (limit daha aşağıdır, alias və List-Unsubscribe olmur).
 * - Kampaniyalar: CRM panelində yazılır, «Göndərişlər» vərəqində növbəyə düşür və
 *   hər 5 dəqiqədən bir partiyalarla göndərilir (gündəlik limit nəzərə alınır).
 * - Hər məktubda bir kliklə abunədən çıxma linki və List-Unsubscribe başlıqları olur.
 * - Geri qayıdan (bounce) məktubları Gmail-də tapır və həmin ünvanları «Çatdırılmır» kimi qeyd edir.
 * Ətraflı: QURAŞDIRMA.md → «E-poçt xidməti»
 */

// ============ E-POÇT AYARLARI ============
const FROM_EMAIL  = '';    // Boş = skripti dərc edən hesab. Alias (məs. info@code.edu.az) Gmail-də «Send mail as» kimi qurulmalıdır.
const DAILY_LIMIT = 450;   // Bütün məktublar üçün gündəlik limit. Pulsuz Gmail: 500-dən az, Google Workspace: 2000-dən az saxlayın.
const SEND_GAP_MS = 150;   // Məktublar arasında fasilə (millisaniyə)
// =========================================

const BATCH_MS = 270000;   // bir növbə işinin maksimum müddəti (Apps Script limiti 6 dəqiqədir)
const CAMP_SHEET = 'Kampaniyalar';
const SENDS_SHEET = 'Göndərişlər';
const CAMP_HEADERS = ['ID', 'Yaradılıb', 'Ad', 'Mövzu', 'Başlıq', 'Mətn', 'Düymə mətni', 'Düymə linki', 'Auditoriya',
  'Status', 'Alıcılar', 'Göndərildi', 'Xəta', 'Ötürüldü', 'Başladı', 'Bitdi', 'Yeniləndi'];
const CC = { id: 1, created: 2, name: 3, subject: 4, headline: 5, body: 6, btnText: 7, btnUrl: 8, audience: 9,
  status: 10, total: 11, sent: 12, failed: 13, skipped: 14, started: 15, finished: 16, updated: 17 };
const SEND_HEADERS = ['Növbəyə düşüb', 'Kampaniya ID', 'Lead ID', 'E-poçt', 'Ad', 'Status', 'Göndərilib', 'Xəta', 'Gmail ID'];
const SC = { queued: 1, camp: 2, lead: 3, email: 4, name: 5, status: 6, sentAt: 7, error: 8, msgId: 9 };
const CS = { DRAFT: 'Qaralama', QUEUED: 'Növbədə', SENDING: 'Göndərilir', PAUSED: 'Dayandırılıb', DONE: 'Bitdi', CANCELLED: 'Ləğv edilib' };
const SS = { QUEUED: 'Növbədə', SENT: 'Göndərildi', FAILED: 'Xəta', SKIPPED: 'Ötürüldü' };
const LEAD_ACTIVE = 'Aktiv';
const LEAD_UNSUB = 'Abunədən çıxıb';
const LEAD_BOUNCED = 'Çatdırılmır';
const BOUNCE_LABEL = 'CRM-bounce';

// ---------- göndərmə ----------

function gmailReady_() {
  try { return typeof Gmail !== 'undefined' && !!Gmail.Users && !!Gmail.Users.Messages; } catch (e) { return false; }
}
function senderEmail_() { return FROM_EMAIL || Session.getEffectiveUser().getEmail(); }

/** Bir məktub göndərir. o: {to, subject, html, text, unsubUrl?, campaignId?}. Gmail mesaj ID-ni qaytarır. */
function sendMail_(o) {
  if (quotaLeft_() <= 0) throw new Error('Gündəlik limit doldu (DAILY_LIMIT)');
  if (!/^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]{2,}$/.test(String(o.to))) throw new Error('Yanlış ünvan');
  let id = '';
  if (gmailReady_()) {
    const res = Gmail.Users.Messages.send({ raw: mime_(o) }, 'me');
    id = (res && res.id) || '';
  } else {
    const m = { to: o.to, name: FROM_NAME, subject: o.subject, htmlBody: o.html, body: o.text };
    if (REPLY_TO) m.replyTo = REPLY_TO;
    MailApp.sendEmail(m);
  }
  quotaUse_(1);
  return id;
}

function b64_(s) { return Utilities.base64Encode(String(s), Utilities.Charset.UTF_8); }
// Başlıq üçün RFC 2047 kodlaşdırması (uzun mövzu bir neçə «encoded-word»-ə bölünür).
function hdr_(s) {
  s = String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim();
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  const chars = Array.from(s), parts = [];
  for (let i = 0; i < chars.length; i += 20) parts.push('=?UTF-8?B?' + b64_(chars.slice(i, i + 20).join('')) + '?=');
  return parts.join('\r\n ');
}
function wrap76_(s) { return s.replace(/(.{76})/g, '$1\r\n'); }

/** RFC 2822 MIME (multipart/alternative: mətn + HTML), base64url — Gmail API «raw» üçün. */
function mime_(o) {
  const b = 'ca_' + Utilities.getUuid().replace(/-/g, '');
  const h = [
    'From: ' + hdr_(FROM_NAME) + ' <' + senderEmail_() + '>',
    'To: ' + String(o.to).replace(/[\r\n<>,]/g, ''),
    'Subject: ' + hdr_(o.subject),
    'MIME-Version: 1.0'
  ];
  if (REPLY_TO) h.push('Reply-To: ' + REPLY_TO);
  if (o.unsubUrl) {
    h.push('List-Unsubscribe: <' + o.unsubUrl + '>');
    h.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  }
  if (o.campaignId) h.push('X-Campaign-ID: ' + String(o.campaignId).replace(/[^\w-]/g, ''));
  h.push('Content-Type: multipart/alternative; boundary="' + b + '"');
  const body = [
    '--' + b, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76_(b64_(o.text || '')),
    '--' + b, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76_(b64_(o.html || '')),
    '--' + b + '--', ''
  ];
  return Utilities.base64EncodeWebSafe(h.join('\r\n') + '\r\n\r\n' + body.join('\r\n'));
}

// ---------- gündəlik limit ----------

function dayKey_() { return 'SENT_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd'); }
function sentToday_() { return Number(PropertiesService.getScriptProperties().getProperty(dayKey_()) || 0); }
function quotaUse_(n) {
  const p = PropertiesService.getScriptProperties(), k = dayKey_();
  p.setProperty(k, String(Number(p.getProperty(k) || 0) + n));
}
function quotaLeft_() {
  let left = DAILY_LIMIT - sentToday_();
  if (!gmailReady_()) { try { left = Math.min(left, MailApp.getRemainingDailyQuota()); } catch (e) {} }
  return Math.max(0, left);
}
function cleanupQuotaKeys_() {
  const p = PropertiesService.getScriptProperties(), today = dayKey_();
  Object.keys(p.getProperties()).forEach(k => { if (/^SENT_\d{8}$/.test(k) && k < today) p.deleteProperty(k); });
}

// ---------- şablon ----------
// DİQQƏT: Admin.html-də eyni şablonun surəti var (önizləmə üçün). Birini dəyişsəniz, digərini də dəyişin.

function personalize_(s, name) { return String(s == null ? '' : s).split('{{ad}}').join(name || ''); }
function fmtBody_(text, name) {
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(p => {
    let h = esc_(personalize_(p.trim(), name));
    h = h.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    h = h.replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" style="color:#B800B2">$1</a>');
    h = h.replace(/\n/g, '<br>');
    return h ? '<p style="margin:0 0 14px">' + h + '</p>' : '';
  }).join('');
}
/** c: {headline, body, btnText, btnUrl, name, unsubUrl, reason} → {html, text} */
function renderEmail_(c) {
  const name = c.name || '';
  const headline = esc_(personalize_(c.headline, name));
  const btn = c.btnText && /^https?:\/\//.test(c.btnUrl || '')
    ? '<p style="text-align:center;margin:26px 0 22px"><a href="' + esc_(c.btnUrl) + '" style="background:#FE00F6;color:#141414;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:12px;display:inline-block">' + esc_(personalize_(c.btnText, name)) + '</a></p>'
    : '';
  const reason = c.reason || 'Bu məktubu Code Academy-dən məlumat almağa razılıq verdiyiniz üçün alırsınız.';
  const unsub = c.unsubUrl ? ' <a href="' + esc_(c.unsubUrl) + '" style="color:#5E5A55">Abunədən çıx</a>' : '';
  const html =
    '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:16px 8px;background:#F6F5F2">' +
    '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#141414;line-height:1.55;font-size:15px">' +
    '<div style="background:#141414;color:#fff;padding:28px 24px;border-radius:16px 16px 0 0">' +
    '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#FE00F6;font-weight:bold">Code Academy</div>' +
    (headline ? '<h1 style="font-size:24px;line-height:1.25;margin:10px 0 0">' + headline + '</h1>' : '') + '</div>' +
    '<div style="background:#fff;border:1px solid #E6E3DE;border-top:0;padding:24px;border-radius:0 0 16px 16px">' +
    fmtBody_(c.body, name) + btn + '</div>' +
    '<p style="font-size:12px;color:#5E5A55;padding:14px 8px;margin:0">' + esc_(reason) + unsub + '</p>' +
    '</div></body></html>';
  const text = [
    personalize_(c.headline, name),
    '',
    personalize_(c.body, name).replace(/\*\*(.+?)\*\*/g, '$1'),
    btn ? '\n' + personalize_(c.btnText, name) + ': ' + c.btnUrl : '',
    '',
    '--',
    reason,
    c.unsubUrl ? 'Abunədən çıxmaq: ' + c.unsubUrl : ''
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { html: html, text: text };
}

// ---------- abunədən çıxma linki ----------

/** Veb tətbiqin /exec linki. Trigger-lərdə getUrl() etibarsız ola bildiyi üçün veb sorğularda yadda saxlanır. */
function rememberUrl_() {
  try {
    const u = ScriptApp.getService().getUrl();
    if (u && /\/exec$/.test(u)) PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', u);
  } catch (e) {}
}
function webappUrl_() {
  const saved = PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
  if (saved) return saved;
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}
function unsubUrl_(email) {
  const base = webappUrl_();
  return base ? base + '?unsub=' + encodeURIComponent(email) + '&t=' + token_(email) : '';
}

// ---------- vərəqlər ----------

function tabSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#141414').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}
function campSheet_() { return tabSheet_(CAMP_SHEET, CAMP_HEADERS); }
function sendsSheet_() { return tabSheet_(SENDS_SHEET, SEND_HEADERS); }
function cleanMulti_(s, max) {
  s = String(s == null ? '' : s).replace(/\r/g, '').slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function camp_(r) {
  let aud = {};
  try { aud = JSON.parse(r[CC.audience - 1] || '{}'); } catch (e) {}
  const c = {
    id: String(r[CC.id - 1]), created: iso_(r[CC.created - 1]), name: unq_(r[CC.name - 1]), subject: unq_(r[CC.subject - 1]),
    headline: unq_(r[CC.headline - 1]), body: unq_(r[CC.body - 1]), btnText: unq_(r[CC.btnText - 1]), btnUrl: unq_(r[CC.btnUrl - 1]),
    audience: { stages: aud.stages || [], sources: aud.sources || [] },
    status: String(r[CC.status - 1] || CS.DRAFT), total: Number(r[CC.total - 1]) || 0, sent: Number(r[CC.sent - 1]) || 0,
    failed: Number(r[CC.failed - 1]) || 0, skipped: Number(r[CC.skipped - 1]) || 0,
    started: iso_(r[CC.started - 1]), finished: iso_(r[CC.finished - 1]), updated: iso_(r[CC.updated - 1])
  };
  c.queued = Math.max(0, c.total - c.sent - c.failed - c.skipped);
  return c;
}
function campRows_() {
  const sh = campSheet_(), last = sh.getLastRow();
  return { sh: sh, rows: last > 1 ? sh.getRange(2, 1, last - 1, CAMP_HEADERS.length).getValues() : [] };
}
function findCamp_(id) {
  const d = campRows_();
  for (let i = 0; i < d.rows.length; i++) if (String(d.rows[i][0]) === String(id)) return { sh: d.sh, row: i + 2, camp: camp_(d.rows[i]) };
  throw new Error('Kampaniya tapılmadı');
}

// ---------- auditoriya ----------

/** Göndərilə bilən lead-lər: yalnız «Aktiv» (razılıq verib, abunədən çıxmayıb, çatdırılır), e-poçta görə təkrarsız. */
function audience_(aud) {
  aud = aud || {};
  const stages = aud.stages || [], sources = aud.sources || [];
  const sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  const rows = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const seen = {}, out = [];
  rows.forEach(r => {
    const email = String(r[COL.email - 1] || '').trim().toLowerCase();
    if (!email || seen[email]) return;
    const l = lead_(r);
    if (l.status !== LEAD_ACTIVE) return;
    if (stages.length && stages.indexOf(l.stage) < 0) return;
    if (sources.length && sources.indexOf(l.src || '') < 0) return;
    seen[email] = 1;
    out.push({ id: l.id, email: email, name: l.name });
  });
  return out;
}
function leadStatusMap_() {
  const sh = sheet_(), last = sh.getLastRow(), m = {};
  if (last < 2) return m;
  sh.getRange(2, 1, last - 1, COL.status).getValues().forEach(r => {
    const e = String(r[COL.email - 1] || '').toLowerCase();
    if (!e) return;
    const s = String(r[COL.status - 1] || LEAD_ACTIVE);
    // eyni e-poçtun bir sətri belə abunədən çıxıbsa, göndərmirik
    if (!m[e] || s !== LEAD_ACTIVE) m[e] = s;
  });
  return m;
}

// ---------- növbə ----------

// Eyni anda yalnız bir növbə işi: qısa kilid altında «işləyir» bayrağı qoyulur.
function claimRunner_(ms) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) return false;
  try {
    const p = PropertiesService.getScriptProperties();
    if (Number(p.getProperty('QUEUE_UNTIL') || 0) > Date.now()) return false;
    p.setProperty('QUEUE_UNTIL', String(Date.now() + ms + 60000));
    return true;
  } finally { lock.releaseLock(); }
}
function releaseRunner_() { PropertiesService.getScriptProperties().deleteProperty('QUEUE_UNTIL'); }

/**
 * Növbədəki məktubları göndərir. Trigger hər 5 dəqiqədən bir çağırır; paneldən «Göndərməyə başla» da çağırır.
 * Abunədən çıxanlar və çatdırılmayan ünvanlar göndərmə anında yenidən yoxlanır və ötürülür.
 */
function processQueue(maxMs) {
  if (typeof maxMs !== 'number') maxMs = BATCH_MS;       // trigger event obyekti ötürür
  maxMs = Math.min(maxMs, BATCH_MS);
  const t0 = Date.now();
  if (!claimRunner_(maxMs)) return { busy: true, sent: 0 };
  let sent = 0, done = 0;
  try {
    const sh = sendsSheet_(), last = sh.getLastRow();
    if (last < 2) return { sent: 0 };
    const rows = sh.getRange(2, 1, last - 1, SEND_HEADERS.length).getValues();
    let camps = activeCamps_();
    if (!Object.keys(camps).length) return { sent: 0 };
    const leadStatus = leadStatusMap_();
    let left = quotaLeft_();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r[SC.status - 1] !== SS.QUEUED) continue;
      if (done && done % 20 === 0) camps = activeCamps_();   // dayandırma/ləğv tez nəzərə alınsın
      const camp = camps[String(r[SC.camp - 1])];
      if (!camp) continue;
      if (Date.now() - t0 > maxMs || left <= 0) break;
      const email = String(r[SC.email - 1]).toLowerCase();
      let out;
      if ((leadStatus[email] || LEAD_ACTIVE) !== LEAD_ACTIVE) {
        out = [SS.SKIPPED, new Date(), 'Lead statusu: ' + leadStatus[email], ''];
      } else {
        try {
          const id = sendCampaignTo_(camp, { email: email, name: unq_(r[SC.name - 1]) });
          out = [SS.SENT, new Date(), '', id];
          left--; sent++;
        } catch (err) {
          const m = String((err && err.message) || err);
          if (/limit|quota|rate|too many|daily/i.test(m)) break;   // sətir növbədə qalır, sonra davam edəcək
          out = [SS.FAILED, new Date(), m.slice(0, 200), ''];
        }
        if (SEND_GAP_MS) Utilities.sleep(SEND_GAP_MS);
      }
      sh.getRange(i + 2, SC.status, 1, 4).setValues([out]);
      done++;
    }
  } finally {
    releaseRunner_();
    try { recountAll_(); } catch (e) { console.error(e); }
  }
  return { sent: sent };
}
function activeCamps_() {
  const m = {};
  campRows_().rows.forEach(r => { const c = camp_(r); if (c.status === CS.QUEUED || c.status === CS.SENDING) m[c.id] = c; });
  return m;
}
function sendCampaignTo_(camp, lead) {
  const unsub = unsubUrl_(lead.email);
  if (!unsub) throw new Error('Abunədən çıxma linki yaradılmadı: veb tətbiq dərc olunmayıb');
  const r = renderEmail_({ headline: camp.headline, body: camp.body, btnText: camp.btnText, btnUrl: camp.btnUrl, name: lead.name, unsubUrl: unsub });
  return sendMail_({ to: lead.email, subject: personalize_(camp.subject, lead.name), html: r.html, text: r.text, unsubUrl: unsub, campaignId: camp.id });
}

/** «Göndərişlər» vərəqinə görə kampaniya saylarını yeniləyir və bitənləri «Bitdi» edir. */
function recountAll_() {
  const s = sendsSheet_(), last = s.getLastRow();
  const cnt = {};
  if (last > 1) s.getRange(2, SC.camp, last - 1, SC.status - SC.camp + 1).getValues().forEach(r => {
    const id = String(r[0]), st = r[SC.status - SC.camp];
    const c = cnt[id] = cnt[id] || { total: 0, sent: 0, failed: 0, skipped: 0, queued: 0 };
    c.total++;
    if (st === SS.SENT) c.sent++; else if (st === SS.FAILED) c.failed++; else if (st === SS.SKIPPED) c.skipped++; else c.queued++;
  });
  const d = campRows_();
  d.rows.forEach((r, i) => {
    const c = camp_(r), n = cnt[c.id];
    if (!n || c.status === CS.DRAFT) return;
    let status = c.status, finished = r[CC.finished - 1];
    if ((status === CS.QUEUED || status === CS.SENDING) && n.queued === 0) { status = CS.DONE; finished = finished || new Date(); }
    else if (status === CS.QUEUED && (n.sent + n.failed + n.skipped) > 0) status = CS.SENDING;
    const cur = [c.total, c.sent, c.failed, c.skipped].join();
    if (cur === [n.total, n.sent, n.failed, n.skipped].join() && status === c.status) return;
    // statusu təzə oxuyuruq ki, bu arada edilmiş dayandırma/ləğv üzərinə yazılmasın
    const fresh = String(d.sh.getRange(i + 2, CC.status).getValue());
    if (fresh !== c.status) status = fresh;
    d.sh.getRange(i + 2, CC.status, 1, 8).setValues([[status, n.total, n.sent, n.failed, n.skipped, r[CC.started - 1], finished, new Date()]]);
  });
}

// ---------- bounce ----------

/** Gmail-də son 14 günün «çatdırılmadı» məktublarını tapır və həmin lead-ləri «Çatdırılmır» edir. Trigger 6 saatdan bir çağırır. */
function scanBounces() {
  cleanupQuotaKeys_();
  if (!gmailReady_()) return 0;
  const labelId = bounceLabel_();
  const res = Gmail.Users.Messages.list('me', { q: 'from:(mailer-daemon OR postmaster) newer_than:14d -label:' + BOUNCE_LABEL, maxResults: 100 });
  const msgs = (res && res.messages) || [];
  if (!msgs.length) return 0;
  const bad = {};
  msgs.forEach(m => {
    const full = Gmail.Users.Messages.get('me', m.id, { format: 'metadata', metadataHeaders: ['X-Failed-Recipients'] });
    ((full.payload && full.payload.headers) || []).forEach(h => {
      if (/^x-failed-recipients$/i.test(h.name)) String(h.value).split(',').forEach(e => { e = e.trim().toLowerCase(); if (e) bad[e] = 1; });
    });
  });
  Gmail.Users.Messages.batchModify({ ids: msgs.map(m => m.id), addLabelIds: [labelId] }, 'me');
  let marked = 0;
  if (Object.keys(bad).length) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) return 0;
    try {
      const sh = sheet_(), last = sh.getLastRow();
      if (last > 1) {
        const r = sh.getRange(2, COL.status, last - 1, 1), st = r.getValues();
        const em = sh.getRange(2, COL.email, last - 1, 1).getValues();
        em.forEach((e, i) => { if (bad[String(e[0]).toLowerCase()] && st[i][0] === LEAD_ACTIVE) { st[i][0] = LEAD_BOUNCED; marked++; } });
        if (marked) r.setValues(st);
      }
    } finally { lock.releaseLock(); }
  }
  console.log('Bounce: ' + msgs.length + ' məktub yoxlandı, ' + marked + ' lead «' + LEAD_BOUNCED + '» edildi.');
  return marked;
}
function bounceLabel_() {
  const list = (Gmail.Users.Labels.list('me').labels || []);
  const found = list.filter(l => l.name === BOUNCE_LABEL)[0];
  if (found) return found.id;
  return Gmail.Users.Labels.create({ name: BOUNCE_LABEL, labelListVisibility: 'labelHide', messageListVisibility: 'hide' }, 'me').id;
}

// ---------- CRM paneli üçün API (google.script.run) ----------

function emailStatus_() {
  const ready = gmailReady_();
  let fromOk = true;
  if (ready && FROM_EMAIL) {
    try {
      const sa = (Gmail.Users.Settings.SendAs.list('me').sendAs || []).map(s => String(s.sendAsEmail).toLowerCase());
      fromOk = sa.indexOf(FROM_EMAIL.toLowerCase()) > -1;
    } catch (e) { fromOk = false; }
  }
  return {
    gmail: ready, from: senderEmail_(), fromName: FROM_NAME, fromOk: fromOk,
    sentToday: sentToday_(), limit: DAILY_LIMIT, left: quotaLeft_(),
    unsubOk: !!webappUrl_(),
    triggers: ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction())
  };
}

function adminCampaigns(key) {
  guard_(key);
  const camps = campRows_().rows.map(camp_).sort((a, b) => (a.created < b.created ? 1 : -1));
  return { campaigns: camps, email: emailStatus_() };
}

/** Qaralamanı yaradır və ya yeniləyir. */
function adminSaveCampaign(key, c) {
  guard_(key);
  c = c || {};
  const name = String(c.name || '').trim().slice(0, 100) || 'Adsız kampaniya';
  const subject = String(c.subject || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 150);
  const btnUrl = String(c.btnUrl || '').trim();
  if (btnUrl && !/^https?:\/\//.test(btnUrl)) throw new Error('Düymə linki http:// və ya https:// ilə başlamalıdır');
  const aud = JSON.stringify({
    stages: (c.audience && c.audience.stages || []).filter(s => STAGES.indexOf(s) > -1),
    sources: (c.audience && c.audience.sources || []).map(s => String(s).slice(0, 120))
  });
  const vals = [cleanMulti_(name, 100), cleanMulti_(subject, 150), cleanMulti_(c.headline, 200), cleanMulti_(c.body, 20000),
    cleanMulti_(c.btnText, 60), cleanMulti_(btnUrl, 500), aud];
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Cədvəl məşğuldur, bir az sonra yenidən cəhd edin.');
  try {
    if (c.id) {
      const f = findCamp_(c.id);
      if (f.camp.status !== CS.DRAFT) throw new Error('Göndərilməyə başlamış kampaniyanı dəyişmək olmaz. «Kopyala» ilə yenisini yaradın.');
      f.sh.getRange(f.row, CC.name, 1, vals.length).setValues([vals]);
      f.sh.getRange(f.row, CC.updated).setValue(new Date());
      return camp_(f.sh.getRange(f.row, 1, 1, CAMP_HEADERS.length).getValues()[0]);
    }
    const sh = campSheet_();
    const row = [newId_(), new Date()].concat(vals).concat([CS.DRAFT, 0, 0, 0, 0, '', '', new Date()]);
    sh.appendRow(row);
    return camp_(sh.getRange(sh.getLastRow(), 1, 1, CAMP_HEADERS.length).getValues()[0]);
  } finally { lock.releaseLock(); }
}

function adminAudienceCount(key, aud) { guard_(key); return audience_(aud).length; }

/** Sınaq məktubu: kampaniyanı (saxlanmamış olsa da) bir ünvana göndərir. */
function adminTestCampaign(key, c, to) {
  guard_(key);
  to = String(to || senderEmail_()).trim().toLowerCase();
  if (!c || !String(c.subject || '').trim()) throw new Error('Mövzu boşdur');
  const camp = { id: 'test', subject: '[SINAQ] ' + c.subject, headline: c.headline, body: c.body, btnText: c.btnText, btnUrl: c.btnUrl };
  sendCampaignTo_(camp, { email: to, name: 'Aysel' });
  return { to: to, left: quotaLeft_() };
}

/** Qaralamanı növbəyə salır və ilk partiyanı dərhal göndərir. */
function adminStartCampaign(key, id) {
  guard_(key);
  if (!webappUrl_()) throw new Error('Veb tətbiq dərc olunmayıb: abunədən çıxma linki yaradıla bilmir.');
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Cədvəl məşğuldur, bir az sonra yenidən cəhd edin.');
  let f;
  try {
    f = findCamp_(id);
    const c = f.camp;
    if (c.status !== CS.DRAFT) throw new Error('Bu kampaniya artıq başladılıb');
    if (!c.subject.trim() || !c.body.trim()) throw new Error('Mövzu və mətn boş ola bilməz');
    const people = audience_(c.audience);
    if (!people.length) throw new Error('Auditoriyada aktiv alıcı yoxdur');
    const now = new Date();
    const rows = people.map(p => [now, c.id, p.id, p.email, cleanMulti_(p.name, 60), SS.QUEUED, '', '', '']);
    const s = sendsSheet_();
    s.getRange(s.getLastRow() + 1, 1, rows.length, SEND_HEADERS.length).setValues(rows);
    f.sh.getRange(f.row, CC.status, 1, 8).setValues([[CS.QUEUED, rows.length, 0, 0, 0, now, '', now]]);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
  ensureTriggers_();
  processQueue(25000);    // ilk partiya dərhal (paneldə gözləmə qısa olsun)
  return findCamp_(id).camp;
}

/** action: pause | resume | cancel | delete (yalnız qaralama) | duplicate */
function adminCampaignAction(key, id, action) {
  guard_(key);
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(15000)) throw new Error('Cədvəl məşğuldur, bir az sonra yenidən cəhd edin.');
  try {
    const f = findCamp_(id), c = f.camp, now = new Date();
    const setStatus = s => f.sh.getRange(f.row, CC.status).setValue(s) && f.sh.getRange(f.row, CC.updated).setValue(now);
    if (action === 'pause') {
      if (c.status !== CS.QUEUED && c.status !== CS.SENDING) throw new Error('Yalnız göndərilən kampaniyanı dayandırmaq olar');
      setStatus(CS.PAUSED);
    } else if (action === 'resume') {
      if (c.status !== CS.PAUSED) throw new Error('Kampaniya dayandırılmayıb');
      setStatus(CS.SENDING);
    } else if (action === 'cancel') {
      if ([CS.QUEUED, CS.SENDING, CS.PAUSED].indexOf(c.status) < 0) throw new Error('Bu kampaniyanı ləğv etmək olmaz');
      setStatus(CS.CANCELLED);
      const s = sendsSheet_(), last = s.getLastRow();
      if (last > 1) {
        const r = s.getRange(2, SC.camp, last - 1, SC.error - SC.camp + 1), v = r.getValues();
        let ch = false;
        v.forEach(x => { if (String(x[0]) === c.id && x[SC.status - SC.camp] === SS.QUEUED) { x[SC.status - SC.camp] = SS.SKIPPED; x[SC.error - SC.camp] = 'Kampaniya ləğv edildi'; ch = true; } });
        if (ch) r.setValues(v);
      }
    } else if (action === 'delete') {
      if (c.status !== CS.DRAFT) throw new Error('Yalnız qaralamanı silmək olar');
      f.sh.deleteRow(f.row);
      return { deleted: true };
    } else if (action === 'duplicate') {
      lock.releaseLock();
      return adminSaveCampaign(key, { name: c.name + ' (surət)', subject: c.subject, headline: c.headline, body: c.body, btnText: c.btnText, btnUrl: c.btnUrl, audience: c.audience });
    } else {
      throw new Error('Naməlum əməliyyat');
    }
  } finally { try { lock.releaseLock(); } catch (e) {} }
  if (action === 'cancel') recountAll_();
  if (action === 'resume') processQueue(25000);
  return findCamp_(id).camp;
}

/** Kampaniyanın xətaları və son göndərişləri. */
function adminCampaignDetail(key, id) {
  guard_(key);
  const c = findCamp_(id).camp;
  const s = sendsSheet_(), last = s.getLastRow(), errors = [];
  if (last > 1) s.getRange(2, 1, last - 1, SEND_HEADERS.length).getValues().forEach(r => {
    if (String(r[SC.camp - 1]) !== c.id) return;
    const st = r[SC.status - 1];
    if (st === SS.FAILED || st === SS.SKIPPED) errors.push({ email: String(r[SC.email - 1]), status: st, error: unq_(r[SC.error - 1]), at: iso_(r[SC.sentAt - 1]) });
  });
  return { campaign: c, errors: errors.slice(-100).reverse() };
}

// ---------- quraşdırma ----------

function ensureTriggers_() {
  const have = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (have.indexOf('processQueue') < 0) ScriptApp.newTrigger('processQueue').timeBased().everyMinutes(5).create();
  if (have.indexOf('scanBounces') < 0) ScriptApp.newTrigger('scanBounces').timeBased().everyHours(6).create();
}

/** setup() tərəfindən çağırılır: vərəqləri, trigger-ləri yaradır və Gmail API-ni yoxlayır. */
function setupEmail_() {
  campSheet_(); sendsSheet_();
  ensureTriggers_();
  rememberUrl_();
  const st = emailStatus_();
  if (!st.gmail) console.warn('Gmail API qoşulmayıb: Apps Script → Services (+) → Gmail API → Add. İndilik MailApp istifadə olunur.');
  else console.log('Gmail API qoşulub. Göndərən: ' + st.from);
  if (!st.fromOk) console.warn('FROM_EMAIL (' + FROM_EMAIL + ') Gmail-də «Send mail as» kimi qurulmayıb. Gmail → Settings → Accounts → Send mail as.');
  console.log('Gündəlik limit: ' + st.sentToday + ' / ' + st.limit + ' göndərilib.');
}
