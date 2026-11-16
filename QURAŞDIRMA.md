# Landing page-in quraşdırılması (təxminən 15 dəqiqə)

Paketdə bu fayllar var:

- **Email.gs** və **appsscript.json** — Gmail API ilə məktub göndərmə və kampaniyalar (Apps Script-ə əlavə olunur). Bax: «E-poçt xidməti» bölməsi.

- **Admin.html** — lead-ləri izləmək üçün CRM paneli (Apps Script-ə əlavə olunur, saytla birlikdə dərc edilmir). Bax: «CRM paneli» bölməsi.

- **index.html** — landing page-in özü. Loqo və müəllif şəkli faylın içindədir.
- **og-image.png** — link WhatsApp, Facebook, LinkedIn və Telegram-da paylaşılanda görünən şəkil (1200×630).
- **Code.gs** — formdan gələn məlumatları Google Sheets cədvəlinə yazan, yükləyənə avtomatik məktub göndərən və «Abunədən çıx» linkini işlədən skript.

Məlumatlar belə hərəkət edir: forma → Google Apps Script → Google Sheets. Hər lead cədvəldə ayrıca sətir olur. Cədvəli istənilən vaxt Excel və ya CSV kimi yükləyə, ya da e-poçt xidmətinizə köçürə bilərsiniz.

---

## 1. PDF-i hazırlayın

1. Cheat sheet artifaktını açın və **Export → All artboards (.pdf)** ilə PDF yükləyin.
2. PDF-i Google Drive-a yükləyin.
3. Fayla sağ klikləyin, sonra **Paylaş → Ümumi giriş → «Linki olan hər kəs» → Baxış** seçin.
4. Linki kopyalayın. Bu, sizin **PDF_URL** linkinizdir.

## 2. Cədvəli və skripti yaradın

1. [sheets.new](https://sheets.new) ünvanında yeni cədvəl açın və ona ad verin, məsələn «ChatGPT Cheat Sheet — Leads».
2. Menyudan **Genişləndirmələr (Extensions) → Apps Script** açın.
3. Oradakı kodu silin və **Code.gs** faylının bütün məzmununu yapışdırın.
4. Yuxarıdakı ayarlarda `BURAYA_PDF_LINKI` yazısını 1-ci addımdakı linklə əvəz edin.
5. İstəsəniz, `NOTIFY_TO` sahəsinə öz e-poçtunuzu yazın. Onda hər yeni lead barədə sizə bildiriş gələcək. `REPLY_TO` sahəsinə isə məktuba cavabların gedəcəyi ünvanı yaza bilərsiniz (məsələn, info@...).
6. Saxlayın (💾), funksiyalar siyahısından **setup** seçib **Run** düyməsini basın. Google icazə istəyəcək: hesabınızı seçin, **Advanced → Go to … (unsafe)** keçidinə basın, sonra **Allow** seçin. Bu, sizin öz skriptinizdir; xəbərdarlıq ona görə çıxır ki, skript Google tərəfindən yoxlanmayıb.
7. İstəsəniz, **testEmail** funksiyasını işə salın: məktubun necə göründüyünü yoxlamaq üçün sizə sınaq məktubu gələcək.

Bundan sonra cədvəldə başlıqları hazır olan **Leads** vərəqi yaranacaq.

## 3. Skripti veb tətbiq kimi dərc edin

1. Apps Script-də **Deploy → New deployment** açın.
2. Növ olaraq **Web app** seçin.
3. **Execute as:** *Me*, **Who has access:** *Anyone* seçin.
4. **Deploy** basın və çıxan **Web app URL** linkini kopyalayın (`https://script.google.com/macros/s/.../exec`).

> Kodu sonradan dəyişsəniz, **Deploy → Manage deployments → ✏️ → Version: New version** ilə yeniləyin. Belə etsəniz, link dəyişmir.

## 4. Landing page-i doldurun

`index.html` faylını istənilən mətn redaktorunda (məsələn, VS Code-da) açın. Yuxarıdakı `CONFIG` hissəsini doldurun:

```js
SCRIPT_URL: "https://script.google.com/macros/s/.../exec",
PDF_URL: "",              // boş saxlaya bilərsiniz, aşağıya baxın
CONTACT_EMAIL: "info@...",
GA4_ID: "",               // istəyə bağlı: Google Analytics 4
META_PIXEL_ID: ""         // istəyə bağlı: Facebook / Instagram reklamları üçün
```

- **PDF_URL.** Səhifə PDF linkini formu göndərəndən sonra skriptdən alır. Ona görə bu sahəni boş saxlasanız, link səhifənin kodunda görünmür və PDF-i formu doldurmadan götürmək olmur. Ehtiyat üçün yazmaq da olar: skript cavab verə bilməsə, səhifə bu linki göstərəcək.
- **GA4_ID / META_PIXEL_ID.** Yazsanız, uğurlu qeydiyyat GA4-də `generate_lead`, Meta-da `Lead` hadisəsi kimi görünür; PDF düyməsinə klik isə GA4-də `file_download` kimi. Boş qalsa, heç bir izləmə kodu yüklənmir.

Səhifəni açıb sarı «Demo rejim» xəbərdarlığının yox olduğunu yoxlayın.

## 5. Səhifəni internetə çıxarın

Ən sadə yollar:

- **Netlify Drop:** [app.netlify.com/drop](https://app.netlify.com/drop) ünvanına bu qovluğu (index.html və og-image.png ilə) sürükləyin. Bir dəqiqəyə link hazır olur, sonra öz domeninizi də qoşa bilərsiniz.
- **code.edu.az:** faylları saytın komandasına verin, məsələn `code.edu.az/chatgpt` ünvanında yerləşdirsinlər.
- **GitHub Pages:** repo yaradın, faylları yükləyin və **Settings → Pages** bölməsini aktivləşdirin.

> Cloudflare tunnel bu iş üçün uyğun deyil: kompüteriniz söndükdə səhifə də əlçatmaz olur.

**Paylaşma şəkli.** Sayt dərc olunandan sonra `index.html`-də `<meta property="og:image" content="og-image.png">` sətrini tapın və `og-image.png` yazısını şəklin tam linki ilə əvəz edin, məsələn `https://code.edu.az/chatgpt/og-image.png`. Sosial şəbəkələr yalnız tam linki oxuyur. Yoxlamaq üçün linki [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug/) ünvanına yapışdırın.

## 6. Sınaq

1. Telefondan səhifəni açın və öz məlumatlarınızla formu göndərin.
2. Cədvəldə yeni sətrin yarandığını və **Məktub** sütununda «Göndərildi» yazıldığını yoxlayın.
3. Məktubun gəldiyini yoxlayın, sonra məktubdakı «Abunədən çıx» linkini sınayın. Sətrin statusu «Abunədən çıxıb» olmalıdır.
4. Sınaq sətrini silin.

> Səhifə uğurlu qeydiyyatı brauzerdə yadda saxlayır: yenidən açanda form yox, yükləmə düyməsi görünür. Formu yenidən sınamaq üçün «Başqa e-poçtla yenidən göndər» linkinə basın.

## CRM paneli (lead-ləri izləmək)

Bütün lead-ləri bir yerdə görmək, onlarla əlaqə saxlamaq və satış mərhələsini qeyd etmək üçün paneldir. Ayrıca server lazım deyil: panel eyni Apps Script-in içindədir və məlumatı birbaşa cədvəldən oxuyur.

**Quraşdırma (2 dəqiqə):**

1. Apps Script-də sol paneldə **Files** yanındakı **+ → HTML** seçin və faylı **Admin** adlandırın (`.html` yazmayın).
2. Oradakı kodu silin və **Admin.html** faylının bütün məzmununu yapışdırın. Saxlayın.
3. Code.gs-i də ən son versiya ilə əvəz edin, sonra **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** edin.
4. Funksiyalar siyahısından **setup** seçib **Run** basın. Aşağıdakı jurnalda (Execution log) panelin linki görünəcək:
   `CRM paneli (linki heç kimlə paylaşmayın): https://script.google.com/macros/s/.../exec?admin=...`
5. Linki brauzerdə əlfəcinə (bookmark) əlavə edin.

Linki sonra yenidən görmək üçün **adminLink** funksiyasını işə salın.

**Paneldə nə var:**

- **Göstəricilər:** cəmi lead, bu gün, son 7 gün (əvvəlki həftə ilə müqayisə), hələ əlaqə saxlanılmayan «Yeni» lead-lər, qeydiyyatdan keçənlər (konversiya), abunədən çıxanlar və göndərilməyən məktublar.
- **Qrafiklər:** son 30 günün gündəlik lead sayı, mənbələr (utm_source) və satış mərhələləri. Mənbəyə və ya mərhələyə klikləsəniz, siyahı ona görə süzülür.
- **Siyahı:** ad, e-poçt, nömrə və qeydlər üzrə axtarış; mənbə, dövr, status və mərhələ filtrləri. Göstərilən siyahını **CSV** düyməsi ilə Excel-ə yükləmək olar.
- **Lead kartı** (sətrə klikləyin): bir kliklə zəng, WhatsApp və e-poçt; mərhələni dəyişmək; qeyd yazmaq; UTM məlumatları. «Yeni» lead-ə zəng etsəniz və ya yazsanız, o avtomatik «Əlaqə saxlanıldı» mərhələsinə keçir və «Son əlaqə» vaxtı yazılır.
- Abunədən çıxmış şəxslərin kartında əlaqə düymələri gizlənir və xəbərdarlıq göstərilir.
- Panel hər dəqiqə özü yenilənir.

**Mərhələlər:** Yeni → Əlaqə saxlanıldı → Maraqlanır → Qeydiyyatdan keçdi / Maraqlanmır. Siyahını dəyişmək üçün Code.gs-də `STAGES` sətrini redaktə edin.

Paneldəki dəyişikliklər cədvəldəki **Mərhələ**, **Qeyd** və **Son əlaqə** sütunlarına yazılır. Bu sütunları cədvəldə əllə də dəyişə bilərsiniz. **ID** sütununu dəyişməyin və silməyin: panel lead-ləri onunla tapır.

**Təhlükəsizlik:** Linkdəki `admin=` açarı paneli qoruyur. Onu yalnız lead-lərlə işləyən əməkdaşlara verin. Link kənara çıxıbsa, **resetAdminKey** funksiyasını işə salın: köhnə link dərhal işləməz olur və jurnalda yeni link görünür.

> **Admin.html-ə baxış.** Faylı kompüterdə birbaşa açsanız, panel nümunə məlumatlarla «demo» rejimində işləyir. Beləcə onu quraşdırmadan əvvəl görə bilərsiniz.

## E-poçt xidməti (Gmail API ilə kampaniyalar)

Bütün məktublar (xoş gəldin məktubu və kampaniyalar) **Gmail API** ilə, sizin Google hesabınızdan göndərilir. Ayrıca e-poçt xidmətinə (Mailchimp və s.) ehtiyac yoxdur.

**Nə verir:**

- **Kampaniyalar:** CRM panelinin «Kampaniyalar» bölməsində məktub yazırsınız, auditoriyanı (mərhələ və mənbə üzrə) seçirsiniz, özünüzə sınaq məktubu göndərirsiniz və göndərməni başladırsınız.
- **Ad ilə müraciət:** mövzuda, başlıqda və mətndə `{{ad}}` alıcının adı ilə əvəz olunur. `**mətn**` qalın yazılır, linklər avtomatik işləyir.
- **Növbə:** məktublar «Göndərişlər» vərəqində növbəyə düşür və hər 5 dəqiqədən bir partiya ilə gedir. Gündəlik limit dolanda göndərmə dayanır və ertəsi gün özü davam edir. Kampaniyanı istənilən vaxt dayandırmaq, davam etdirmək və ya ləğv etmək olar.
- **Qanuna uyğunluq:** yalnız «Aktiv» abunəçilərə göndərilir. Hər məktubun sonunda «Abunədən çıx» linki olur, başlıqlarda isə Gmail və Yahoo-nun tələb etdiyi **bir kliklə abunədən çıxma** (List-Unsubscribe) var. Göndərmə anında status yenidən yoxlanır: növbədə olarkən abunədən çıxan şəxsə məktub getmir.
- **Çatdırılmayan ünvanlar:** skript 6 saatdan bir Gmail-də «çatdırılmadı» (bounce) məktublarını tapır və həmin lead-ləri «Çatdırılmır» edir. Onlara bir daha məktub göndərilmir.
- **Hesabat:** hər kampaniya üzrə göndərilən, xəta verən və ötürülən məktublar, alıcı səviyyəsində xəta səbəbi.

**Quraşdırma (5 dəqiqə):**

1. Apps Script-də **+ → Script** ilə yeni fayl yaradın, adını **Email** qoyun və **Email.gs** faylının məzmununu yapışdırın.
2. **Gmail API-ni qoşun.** Sol paneldə **Services** yanındakı **+** düyməsinə basın, **Gmail API** seçin və **Add** edin.
   (Alternativ: **Project Settings → «Show "appsscript.json" manifest file»** aktivləşdirin və `appsscript.json` faylını bu paketdəki ilə əvəz edin. Bu, Gmail API-ni qoşur və saat qurşağını Bakı edir.)
3. **Code.gs** və **Admin.html** fayllarını da ən son versiya ilə əvəz edin.
4. **setup** funksiyasını yenidən işə salın. Google Gmail-ə və trigger-lərə yeni icazələr istəyəcək: **Allow** seçin. setup «Kampaniyalar» və «Göndərişlər» vərəqlərini və iki trigger-i (növbə üçün 5 dəqiqədən bir, bounce üçün 6 saatdan bir) yaradır.
5. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
6. CRM panelini açın, **Kampaniyalar** bölməsinə keçin və yuxarıda sarı xəbərdarlıq olmadığını yoxlayın. Sonra özünüzə sınaq məktubu göndərin.

**Email.gs-dəki ayarlar:**

- `FROM_EMAIL` — məktubların hansı ünvandan getdiyi. Boş qalsa, skripti dərc edən hesabdan gedir. Məsələn `info@code.edu.az` yazmaq üçün həmin ünvan əvvəlcə Gmail-də **Settings → Accounts → Send mail as** bölməsində əlavə və təsdiq olunmalıdır. Panel bunu yoxlayır və qurulmayıbsa xəbərdarlıq göstərir.
- `DAILY_LIMIT` — gündəlik ümumi limit (xoş gəldin məktubları da daxil). Google-un limiti pulsuz Gmail üçün təxminən **500**, Google Workspace üçün **2 000** məktubdur. Ehtiyat payı ilə 450 və ya 1 800 yazın.
- `FROM_NAME` və `REPLY_TO` Code.gs-dədir və bütün məktublara aiddir.

**Məktubların spama düşməməsi üçün:**

- Göndərən domen üçün (məsələn, code.edu.az) DNS-də **SPF, DKIM və DMARC** qurulmalıdır. Google Workspace istifadə edirsinizsə: Admin console → Apps → Gmail → **Authenticate email** bölməsində DKIM-i aktivləşdirin. Bunu domeni idarə edən sistem administratoru edə bilər.
- Əvvəlcə kiçik auditoriyaya göndərin və sayı tədricən artırın.
- Mövzuda hamısı böyük hərflə yazmayın və çoxlu nida işarəsi qoymayın.

**Məhdudiyyətlər:** Məktubun açılması (open) və linkə klik izlənmir. Apps Script bunun üçün lazım olan şəkil və yönləndirmə cavablarını verə bilmir. Göndərilən məktubların surətini Gmail-in «Göndərilənlər» (Sent) qovluğunda görəcəksiniz.

## Mənbəni izləmək (UTM)

Hər kanal üçün linkə etiket əlavə edin. Etiket cədvəldə ayrıca sütunda görünəcək:

- Təlim slaydındakı QR: `...?utm_source=telim&utm_campaign=ali-mehkeme`
- Instagram: `...?utm_source=instagram&utm_medium=bio`
- LinkedIn post: `...?utm_source=linkedin&utm_medium=post`

## Səhifədə nələr var

- Ad, e-poçt və nömrə yoxlanılır. Nömrə avtomatik `50 123 45 67` formatına salınır; `+994 50…` və ya `050…` kimi yapışdırılan nömrələr də düzgün qəbul olunur.
- E-poçtda tez-tez olan yazı səhvləri üçün düzəliş təklif olunur (məsələn, `gmial.com` → `gmail.com`).
- Eyni e-poçt 10 dəqiqə ərzində ikinci dəfə göndərilsə, cədvəldə təkrar sətir yaranmır.
- Spam-botlar üçün gizli tələ sahəsi var.
- Telefonda forma ekrandan çıxanda aşağıda «Pulsuz yüklə» düyməsi görünür.

## Bilməli olduğunuz məqamlar

- **Məktub limiti.** Gmail API ilə pulsuz Gmail hesabı gündə təxminən 500, Google Workspace hesabı isə 2 000 məktub göndərə bilir. Skript `DAILY_LIMIT` (Email.gs) ilə bundan aşağı qalır; limit dolanda xoş gəldin məktubu göndərilmir (**Məktub** sütununda «Xəta» yazılır), kampaniyalar isə ertəsi gün özü davam edir. Yükləmə düyməsi səhifədə hər halda görünür.
- **Reklam göndərəndə.** Göndərməzdən əvvəl cədvəli **Status = Aktiv** üzrə süzün. «Abunədən çıxıb» olanlara heç nə göndərməyin.
- **Şərtlər mətni.** Bu mətn hüquqi şablondur. Dərc etməzdən əvvəl Code Academy-nin hüquqşünası ilə razılaşdırın. Mətni dəyişsəniz, `TERMS_VERSION` sahəsini də yeniləyin: hər lead-in hansı versiyaya razılıq verdiyi cədvəldə saxlanır.
- **Cədvələ giriş.** Cədvəldə şəxsi məlumatlar var. Onu yalnız işi olan əməkdaşlarla paylaşın.
- **Köhnə versiyadan keçid.** Əvvəlki Code.gs ilə yaradılmış cədvəl də işləyəcək: skript «Məktub» sütununu özü əlavə edir.
