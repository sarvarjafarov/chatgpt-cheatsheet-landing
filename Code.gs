/**
 * Code Academy · ChatGPT Cheat Sheet: lead toplama skripti
 * Google Sheets → Genişləndirmələr (Extensions) → Apps Script → bu kodu yapışdırın.
 * Ətraflı: QURAŞDIRMA.md
 */

// ============ AYARLAR ============
const SHEET_NAME = 'Leads';                 // Məlumatların yazılacağı vərəq
const PDF_URL    = 'BURAYA_PDF_LINKI';       // Cheat sheet PDF linki. Landing səhifəsi linki buradan alır.
const SEND_EMAIL = true;                    // Yükləyənə avtomatik məktub göndərilsin?
const FROM_NAME  = 'Code Academy';          // Məktubda göndərən adı
const REPLY_TO   = '';                      // Məktuba cavab hansı ünvana getsin (boş = sizin hesab)
const NOTIFY_TO  = '';                      // Hər yeni lead üçün sizə bildiriş: e-poçt yazın və ya boş saxlayın
// =================================

const HEADERS = ['Tarix', 'Ad', 'E-poçt', 'Telefon', 'Razılıq', 'Şərtlərin versiyası',
  'Razılıq mətni', 'utm_source', 'utm_medium', 'utm_campaign', 'Haradan gəlib', 'Səhifə',
  'Status', 'Abunədən çıxma tarixi', 'Məktub', 'Mərhələ', 'Qeyd', 'Son əlaqə', 'ID'];
const COL = { email: 3, status: 13, unsubAt: 14, mail: 15, stage: 16, note: 17, contacted: 18, id: 19 };
// CRM mərhələləri (CRM paneli və cədvəl eyni siyahını işlədir)
const STAGES = ['Yeni', 'Əlaqə saxlanıldı', 'Maraqlanır', 'Qeydiyyatdan keçdi', 'Maraqlanmır'];
const OPS = ['10', '50', '51', '55', '60', '70', '77', '99'];
const DUP_WINDOW_MS = 10 * 60 * 1000;       // eyni e-poçt bu müddətdə təkrar yazılmır

function pdfUrl_() { return /^https?:\/\//.test(PDF_URL) ? PDF_URL : ''; }

function doPost(e) {
  const q = (e && e.parameter) || {};
  // Gmail/Yahoo «bir kliklə abunədən çıx» düyməsi bu ünvana POST göndərir (List-Unsubscribe-Post).
  if (q.unsub) return json_({ ok: unsubscribe_(q.unsub, q.t) });
  rememberUrl_();
  let d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json_({ ok: false, error: 'invalid' }); }
  if (d.website) return json_({ ok: true, pdf: pdfUrl_() });   // spam-bot tələsi: bot uğur görür, heç nə yazılmır

  const name  = clean_(d.name).slice(0, 61);         // cədvəl üçün (formul qorunması ilə)
  const plain = name.replace(/^'/, '');               // məktub üçün
  const email = String(d.email || '').trim().toLowerCase().slice(0, 120);
  const phone = String(d.phone || '').replace(/[^\d+]/g, '');
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  const okPhone = /^\+994\d{9}$/.test(phone) && OPS.indexOf(phone.slice(4, 6)) > -1;
  if (plain.length < 2 || !okEmail || !okPhone || d.consent !== true) {
    return json_({ ok: false, error: 'invalid' });
  }

  // Cədvələ yazmaq kilid altında (eyni anda gələn sorğular bir-birini pozmasın).
  // Məktub kilid açıldıqdan sonra göndərilir ki, növbədəkilər gözləməsin.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'busy' });
  let row;
  try {
    const sh = sheet_();
    const last = sh.getLastRow();
    if (last > 1) {
      const from = Math.max(2, last - 200);
      const rows = sh.getRange(from, 1, last - from + 1, COL.email).getValues();
      const recent = rows.some(r => String(r[COL.email - 1]).toLowerCase() === email &&
        (Date.now() - new Date(r[0]).getTime()) < DUP_WINDOW_MS);
      if (recent) return json_({ ok: true, duplicate: true, pdf: pdfUrl_() });
    }
    sh.appendRow([
      new Date(), name, email, "'" + phone, 'Bəli',
      clean_(d.consentVersion), clean_(d.consentText),
      clean_(d.utm_source), clean_(d.utm_medium), clean_(d.utm_campaign),
      clean_(d.referrer), clean_(d.page), 'Aktiv', '', '',
      STAGES[0], '', '', newId_()
    ]);
    row = sh.getLastRow();
    SpreadsheetApp.flush();
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }

  if (SEND_EMAIL && pdfUrl_()) {
    let status = 'Göndərildi';
    try { sendWelcome_(plain, email); } catch (err) { console.error(err); status = 'Xəta: ' + String(err.message || err).slice(0, 80); }
    try { sheet_().getRange(row, COL.mail).setValue(status); } catch (err) {}
  }
  if (NOTIFY_TO) {
    try { MailApp.sendEmail(NOTIFY_TO, 'Yeni lead: ' + plain, [plain, email, phone, d.utm_source ? 'Mənbə: ' + d.utm_source : ''].join('\n')); } catch (err) {}
  }
  return json_({ ok: true, pdf: pdfUrl_() });
}

/**
 * GET sorğuları:
 *   ?admin=<ADMIN_KEY>        → CRM paneli (linki setup() funksiyası verir)
 *   ?unsub=<email>&t=<token>  → abunədən çıxma
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  rememberUrl_();
  if (p.admin) {
    if (!keyOk_(p.admin)) return page_('Giriş qadağandır', 'Bu link etibarsızdır. Düzgün linki Apps Script-də setup funksiyası göstərir.');
    rememberUrl_();
    const t = HtmlService.createTemplateFromFile('Admin');
    t.key = p.admin;
    return t.evaluate().setTitle('Leads · CRM')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  if (!p.unsub) return json_({ ok: true });
  if (!unsubscribe_(p.unsub, p.t)) return page_('Link etibarsızdır', 'Zəhmət olmasa, məktubdakı linkdən yenidən istifadə edin.');
  return page_('Abunədən çıxdınız', 'Bundan sonra sizə reklam məktubları göndərilməyəcək. Fikrinizi dəyişsəniz, code.edu.az saytında yenidən qeydiyyatdan keçə bilərsiniz.');
}

/** Token düzgündürsə, həmin e-poçtun bütün sətirlərini «Abunədən çıxıb» edir. */
function unsubscribe_(rawEmail, t) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email || t !== token_(email)) return false;
  const sh = sheet_();
  const last = sh.getLastRow();
  if (last > 1) {
    const vals = sh.getRange(2, COL.email, last - 1, 1).getValues();
    vals.forEach((v, i) => {
      if (String(v[0]).toLowerCase() === email) {
        sh.getRange(i + 2, COL.status).setValue('Abunədən çıxıb');
        sh.getRange(i + 2, COL.unsubAt).setValue(new Date());
      }
    });
  }
  return true;
}

/** Xoş gəldin məktubu (Email.gs-dəki şablon və Gmail API ilə). */
function sendWelcome_(name, email) {
  const unsub = unsubUrl_(email);
  const r = renderEmail_({
    headline: 'ChatGPT cheat sheet-iniz hazırdır',
    body: 'Salam, {{ad}}!\n\nCode Academy-nin ChatGPT cheat sheet-ini seçdiyiniz üçün təşəkkür edirik. Faylı aşağıdakı düymə ilə istənilən vaxt yükləyə bilərsiniz.\n\n' +
      '**Başlamaq üçün məsləhət:** əvvəlcə 3-cü səhifədəki ayarları qurun, sonra 4-cü səhifədəki formulla bir prompt yazın. Fərqi elə ilk cavabda görəcəksiniz.\n\n' +
      'Hörmətlə,\nSərvər Cəfərov\nCode Academy',
    btnText: 'PDF-i yüklə', btnUrl: pdfUrl_(), name: name, unsubUrl: unsubPageUrl_(email),
    reason: 'Bu məktubu cheat sheet-i yüklədiyiniz və Code Academy-dən məlumat almağa razılıq verdiyiniz üçün alırsınız.'
  });
  return sendMail_({ to: email, subject: 'ChatGPT cheat sheet-iniz hazırdır', html: r.html, text: r.text, unsubUrl: unsub });
}

// ---------- köməkçi funksiyalar ----------
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#141414').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('dd.mm.yyyy hh:mm');
    sh.getRange('N:N').setNumberFormat('dd.mm.yyyy hh:mm');
  } else if (sh.getRange(1, HEADERS.length).getValue() === '') {
    // Köhnə versiyadan qalan cədvələ çatışmayan sütunları (Məktub, Mərhələ, Qeyd, ...) əlavə edir.
    const head = sh.getRange(1, 1, 1, HEADERS.length);
    const cur = head.getValues()[0];
    head.setValues([HEADERS.map((h, i) => cur[i] || h)]).setFontWeight('bold').setBackground('#141414').setFontColor('#ffffff');
    sh.getRange('R:R').setNumberFormat('dd.mm.yyyy hh:mm');
  }
  return sh;
}
// Cədvəldə formul kimi işləyə biləcək mətnləri zərərsizləşdirir.
function clean_(v) {
  let s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function esc_(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function secret_() {
  const props = PropertiesService.getScriptProperties();
  let s = props.getProperty('SECRET');
  if (!s) { s = Utilities.getUuid(); props.setProperty('SECRET', s); }
  return s;
}
function token_(email) {
  const sig = Utilities.computeHmacSha256Signature(email, secret_());
  return Utilities.base64EncodeWebSafe(sig).slice(0, 16);
}
function page_(title, text) {
  return HtmlService.createHtmlOutput(
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:Arial,sans-serif;max-width:480px;margin:60px auto;padding:0 20px;color:#141414">' +
    '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#C400BE;font-weight:bold">Code Academy</div>' +
    '<h2>' + esc_(title) + '</h2><p style="line-height:1.55">' + esc_(text) + '</p></div>').setTitle(title);
}

// ============ CRM paneli ============
// Panel Admin.html faylıdır və ?admin=<açar> linki ilə açılır. Açar Script Properties-də saxlanır.
// Aşağıdakı funksiyalar paneldən google.script.run ilə çağırılır və hər dəfə açarı yoxlayır.

function adminKey_() {
  const props = PropertiesService.getScriptProperties();
  let k = props.getProperty('ADMIN_KEY');
  if (!k) { k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); props.setProperty('ADMIN_KEY', k); }
  return k;
}
function keyOk_(k) {
  const s = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!s && typeof k === 'string' && k === s;
}
function guard_(k) { if (!keyOk_(k)) throw new Error('Giriş qadağandır'); }
function newId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function iso_(d) { return d instanceof Date && !isNaN(d) ? d.toISOString() : (d ? String(d) : ''); }
function unq_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }

// Köhnə sətirlərə ID verir (CRM sətirləri ID ilə tapır, sətir silinsə də qarışmır).
function ensureIds_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return;
  const r = sh.getRange(2, COL.id, last - 1, 1);
  const v = r.getValues();
  let changed = false;
  v.forEach(x => { if (!x[0]) { x[0] = newId_(); changed = true; } });
  if (changed) r.setValues(v);
}
function lead_(r) {
  return {
    id: String(r[COL.id - 1]), at: iso_(r[0]), name: unq_(r[1]), email: String(r[2]), phone: unq_(r[3]),
    src: unq_(r[7]), medium: unq_(r[8]), campaign: unq_(r[9]), ref: unq_(r[10]),
    status: String(r[COL.status - 1] || 'Aktiv'), unsubAt: iso_(r[COL.unsubAt - 1]), mail: String(r[COL.mail - 1] || ''),
    stage: STAGES.indexOf(r[COL.stage - 1]) > -1 ? r[COL.stage - 1] : STAGES[0],
    note: unq_(r[COL.note - 1]), contacted: iso_(r[COL.contacted - 1])
  };
}

/** Panel üçün bütün lead-lər. */
function adminData(key) {
  guard_(key);
  const sh = sheet_();
  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) { try { ensureIds_(sh); } finally { lock.releaseLock(); } }
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
  return {
    leads: rows.filter(r => r[2] && r[COL.id - 1]).map(lead_),
    stages: STAGES,
    at: new Date().toISOString(),
    sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
  };
}

/** Bir lead-in mərhələsini, qeydini və ya «son əlaqə» vaxtını dəyişir. patch: {stage?, note?, contacted?: true} */
function adminUpdate(key, id, patch) {
  guard_(key);
  patch = patch || {};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Cədvəl məşğuldur, bir az sonra yenidən cəhd edin.');
  try {
    const sh = sheet_();
    const last = sh.getLastRow();
    if (last < 2) throw new Error('Lead tapılmadı');
    const ids = sh.getRange(2, COL.id, last - 1, 1).getValues();
    let i = -1;
    for (let k = 0; k < ids.length; k++) if (String(ids[k][0]) === String(id)) { i = k; break; }
    if (i < 0) throw new Error('Lead tapılmadı (cədvəldən silinib?)');
    const row = i + 2;
    if (patch.stage !== undefined) {
      if (STAGES.indexOf(patch.stage) < 0) throw new Error('Naməlum mərhələ');
      sh.getRange(row, COL.stage).setValue(patch.stage);
    }
    if (patch.note !== undefined) {
      let n = String(patch.note).slice(0, 2000);
      if (/^[=+\-@]/.test(n)) n = "'" + n;
      sh.getRange(row, COL.note).setValue(n);
    }
    if (patch.contacted) sh.getRange(row, COL.contacted).setValue(new Date());
    SpreadsheetApp.flush();
    return lead_(sh.getRange(row, 1, 1, HEADERS.length).getValues()[0]);
  } finally {
    lock.releaseLock();
  }
}

/** CRM panelinin linkini göstərir. */
function adminLink() {
  const url = webappUrl_();
  if (!url) {
    console.warn('Dərc olunmuş /exec linki hələ məlum deyil. Skripti veb tətbiq kimi dərc edin (Deploy → New deployment), ' +
      'Web app URL linkini brauzerdə bir dəfə açın, sonra bu funksiyanı yenidən işə salın.');
    return;
  }
  const key = adminKey_();
  // Google Workspace hesabı üçün domen linki: brauzerdə bir neçə Google hesabı açıq olanda da düzgün hesabla açılır.
  const dom = String(Session.getEffectiveUser().getEmail() || '').split('@')[1] || '';
  const owner = dom && !/^(gmail|googlemail)\.com$/i.test(dom) ? url.replace('/macros/s/', '/a/macros/' + dom + '/s/') : url;
  console.log('CRM paneli (linki heç kimlə paylaşmayın): ' + owner + '?admin=' + key);
  if (owner !== url) console.log('Alternativ link (gizli/Incognito pəncərə üçün): ' + url + '?admin=' + key);
}

/** Link kənara çıxıbsa: köhnə linki etibarsız edir və yenisini yaradır. */
function resetAdminKey() {
  PropertiesService.getScriptProperties().deleteProperty('ADMIN_KEY');
  adminKey_();
  adminLink();
}

/** Quraşdırmadan sonra bir dəfə işə salın: cədvəli yaradır, icazələri soruşur və ayarları yoxlayır. */
function setup() {
  const sh = sheet_();
  secret_();
  adminKey_();
  ensureIds_(sh);
  try {
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(STAGES, true).setAllowInvalid(false).build();
    sh.getRange(2, COL.stage, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  } catch (err) { console.error(err); }
  if (!pdfUrl_()) console.warn('DİQQƏT: PDF_URL hələ yazılmayıb. Məktub göndərilməyəcək və səhifədə yükləmə düyməsi görünməyəcək.');
  setupEmail_();
  adminLink();
}

/** İstəyə bağlı: özünüzə sınaq məktubu göndərir (setup-dan sonra işə salın). */
function testEmail() {
  const me = Session.getEffectiveUser().getEmail();
  sendWelcome_('Sınaq', me);
  console.log('Sınaq məktubu göndərildi: ' + me);
}
