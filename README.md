# EnterprisePulse Web

[![CI](https://github.com/hamzamaral/enterprise-pulse-web/actions/workflows/ci.yml/badge.svg)](https://github.com/hamzamaral/enterprise-pulse-web/actions/workflows/ci.yml)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)

**EnterprisePulse**, çok şirketli (multi-tenant) kurumsal bir ERP sistemidir. Bu repo, sistemin arayüzüdür:
React 19 + Vite ile yazılmış, Türkçe / İngilizce, açık / koyu temalı tek sayfa uygulaması (SPA).

| Repo                                                                       | İçerik                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------- |
| **enterprise-pulse-web** (bu repo)                                         | React arayüzü                                           |
| [enterprise-pulse-api](https://github.com/hamzamaral/enterprise-pulse-api) | NestJS API, veritabanı, iş kuralları                    |
| [EnterprisePulse](https://github.com/hamzamaral/EnterprisePulse)           | Yol haritası, mimari dokümanlar, ADR'ler, yerel altyapı |

![Stok durumu](docs/screenshots/stock-levels.png)

## Ekranlar

|                                                                                         |                                                                                     |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| ![Giriş](docs/screenshots/login.png)                                                    | ![Stok hareket fişi](docs/screenshots/stock-movement-form.png)                      |
| **Giriş:** demo hesaplar, iki adımlı doğrulama, şifre sıfırlama                         | **Stok fişi:** lot ve son kullanma tarihi, seri numaraları, anlık toplam            |
| ![Stok kartı](docs/screenshots/stock-card.png)                                          | ![Demirbaş](docs/screenshots/asset-detail.png)                                      |
| **Stok kartı:** her hareketin bakiyesi ve birim maliyeti                                | **Demirbaş kartı:** QR etiket, zimmet durumu, net defter değeri                     |
| ![Amortisman](docs/screenshots/asset-depreciation.png)                                  | ![Organizasyon şeması](docs/screenshots/org-chart.png)                              |
| **Amortisman tablosu:** yıllık ve birikmiş amortisman                                   | **Organizasyon şeması:** yönetici hiyerarşisi                                       |
| ![Puantaj](docs/screenshots/timesheet.png)                                              | ![Vardiya planı](docs/screenshots/shift-plan.png)                                   |
| **Puantaj:** geç kalma, devamsızlık, izin ve fazla mesai                                | **Vardiya planı:** haftalık plan, gece vardiyası, önceki haftayı kopyala            |
| ![Demirbaş sayımı](docs/screenshots/asset-count.png)                                    | ![Gösterge paneli](docs/screenshots/dashboard.png)                                  |
| **Demirbaş sayımı:** QR / kamera ile okutma, fark raporu                                | **Gösterge paneli:** yetkiye göre KPI'lar, 6 aylık satış / alış ve nakit grafikleri |
| ![Teklif karşılaştırma](docs/screenshots/purchase-quote-comparison.png)                 | ![Satın alma siparişi](docs/screenshots/purchase-order.png)                         |
| **Teklif karşılaştırma:** kalem bazında en iyi net fiyat, tek tıkla siparişe dönüştürme | **Satın alma siparişi:** teslim alınan / faturalanan miktarlar, bağlı belgeler      |
| ![Satış siparişi](docs/screenshots/sales-order.png)                                     | ![Satış faturası](docs/screenshots/sales-invoice.png)                               |
| **Satış siparişi:** rezerve / sevk / faturalanan miktarlar, kredi limiti kartı          | **Satış faturası:** tahsilat durumu, iade edilen miktarlar, bağlı iadeler           |
| ![Kasa ve bankalar](docs/screenshots/finance-accounts.png)                              | ![Çek detayı](docs/screenshots/finance-cheque.png)                                  |
| **Kasa ve bankalar:** nakit pozisyonu, döviz bazında bakiyeler, portföydeki çekler      | **Çek / senet:** portföy, bankaya verme, tahsil ve hareket geçmişi                  |
| ![Satış analizi](docs/screenshots/reports-sales.png)                                    | ![Nakit akışı](docs/screenshots/reports-cash-flow.png)                              |
| **Satış analizi:** aylık / cari / ürün bazında, iadeler düşülmüş, Excel / PDF           | **Nakit akışı:** dönem başı ve sonu bakiye, aylık giriş / çıkış, belge türleri      |
| ![Satış fırsatları](docs/screenshots/crm-pipeline.png)                                  | ![Satış fırsatı](docs/screenshots/crm-opportunity.png)                              |
| **Satış fırsatları:** sürükle-bırak pano, ağırlıklı hat, kazanma oranı                  | **Satış fırsatı:** aşama çubuğu, bağlı teklifler, aktivite zaman çizelgesi          |
| ![Masraf formları](docs/screenshots/expense-reports.png)                                | ![Masraf formu](docs/screenshots/expense-report.png)                                |
| **Masraf formları:** onay ve ödeme bekleyenler, aylık ve türe göre masraf               | **Masraf formu:** dövizli fişler, limit uyarıları, fiş ekleri, ödeme                |
| ![Projeler](docs/screenshots/projects.png)                                              | ![Görev panosu](docs/screenshots/project-board.png)                                 |
| **Projeler:** ilerleme, kayıtlı süre, bütçe kullanımı, geciken projeler                 | **Görev panosu:** sürükle-bırak, öncelik, sorumlu, harcanan / tahmini süre          |
| ![Bordrolar](docs/screenshots/payroll.png)                                              | ![Ücret pusulası](docs/screenshots/payslip.png)                                     |
| **Bordrolar:** aylık net ödeme ve işveren maliyeti, ödenecek maaşlar                    | **Ücret pusulası:** kazançlar, SGK ve vergi kesintileri, asgari ücret istisnaları   |
| ![İş ilanları](docs/screenshots/recruitment.png)                                        | ![Başvuru hattı](docs/screenshots/recruitment-pipeline.png)                         |
| **İş ilanları:** işe alım hunisi, yaklaşan mülakatlar, ilan bazında başvuru hattı       | **Başvuru hattı:** sürükle-bırak aşamalar, mülakat puanı, teklif durumu             |
| ![Başvuru](docs/screenshots/job-application.png)                                        |                                                                                     |
| **Başvuru:** aşama çubuğu, mülakat değerlendirmeleri, teklifler, süreç geçmişi          |                                                                                     |
| ![Değerlendirme dönemi](docs/screenshots/performance-cycle.png)                         | ![Performans değerlendirmesi](docs/screenshots/performance-review.png)              |
| **Değerlendirme dönemi:** tamamlanma, puan dağılımı, departman kırılımı, formlar        | **Değerlendirme formu:** hedefler, yetkinlikler, öz ve yönetici puanı, sonuç        |
| ![Eğitim oturumları](docs/screenshots/training.png)                                     | ![Zorunlu eğitim uyumu](docs/screenshots/training-compliance.png)                   |
| **Eğitim oturumları:** eğitim saati, maliyet, memnuniyet, uyum oranı                    | **Zorunlu eğitim uyumu:** personel × eğitim sertifika matrisi                       |
| ![Destek kuyruğu](docs/screenshots/support-queue.png)                                   | ![Destek talebi](docs/screenshots/support-ticket.png)                               |
| **Destek kuyruğu:** SLA göstergeleri, 14 günlük trend, ekip iş yükü, kuyruk filtreleri  | **Destek talebi:** yazışma, dahili not, atama, SLA hedefleri, ekler ve geçmiş       |
| ![Sözleşmeler](docs/screenshots/contracts.png)                                          | ![Sözleşme](docs/screenshots/contract.png)                                          |
| **Sözleşmeler:** yıllık gelir / gider, 12 aylık bitiş takvimi, yaklaşan karar tarihleri | **Sözleşme:** süre ve otomatik yenileme, fesih son günü, ekler ve geçmiş            |
| ![Bütçeler](docs/screenshots/budgets.png)                                               | ![Bütçe](docs/screenshots/budget.png)                                               |
| **Bütçeler:** YBK gider ve gelir, departman karşılaştırması, dikkat gerektiren kalemler | **Bütçe:** aylık plan ve gerçekleşen, kalem bazında sapma, belge kırılımı           |
| ![Filo](docs/screenshots/fleet.png)                                                     | ![Araç](docs/screenshots/vehicle.png)                                               |
| **Filo:** maliyet, km ve tüketim göstergeleri, son 12 ay maliyeti, takip gerektirenler  | **Araç:** yıllık özet, sürücü, sonraki bakım, muayene ve sigorta durumu             |
| ![Muhasebe](docs/screenshots/accounting.png)                                            | ![Mizan](docs/screenshots/trial-balance.png)                                        |
| **Muhasebe:** hazır değerler, alacak / borç, aylık gelir ve gider, bekleyen belgeler    | **Mizan:** dönem hareketleri, toplamlar ve bakiyeler, denge kontrolü                |

## Özellikler

- **Platform:** giriş, iki adımlı doğrulama (TOTP), şirket ve şube değiştirme, kullanıcı / rol / izin yönetimi,
  denetim kaydı, Socket.IO ile anlık bildirimler, onay kutusu, ayarlar (para birimi, kur, KDV, birim, numaralandırma, onay akışları).
- **Gösterge paneli:** kullanıcının yetkilerine göre İK, zimmet, stok ve finans (alacak, borç, nakit pozisyonu,
  açık siparişler) KPI'ları, son 6 ayın satış / alış ve nakit akışı grafikleri, kritik stok listesi; personel için
  kalan izin hakkı, onay bekleyen zimmetler, masraflarım ve görevlerim; finans için ödenecek masraflar;
  proje yetkisi olanlar için aktif projeler.
- **İnsan Kaynakları:** personel kartı, departman ve pozisyonlar, organizasyon şeması, izin talebi ve çok adımlı onay,
  "İzinlerim" ve "Mesaim" (giriş-çıkış) self-servis ekranları, aylık puantaj çizelgesi (İK düzeltmesi, Excel'e aktarma),
  vardiya tanımları ve haftalık vardiya planı.
- **Zimmet ve Demirbaş:** demirbaş kartı, QR etiket, zimmet / iade / devir, yazdırılabilir zimmet tutanağı ve elektronik onay,
  bakım kaydı, amortisman tablosu, QR ile demirbaş sayımı ve yazdırılabilir fark raporu, "Zimmetlerim" self-servis ekranı.
- **Stok ve Depo:** stok durumu ve kritik stok filtresi, ürün ve varyantlar, stok kartı, lot ve seri numaraları,
  giriş / çıkış / transfer / düzeltme fişleri, yazdırılabilir fiş, barkod okutarak stok sayımı, depo ve kategori ayarları.
- **Cari hesaplar:** müşteri / tedarikçi kartları, vade ve kredi limiti, döviz, cari hareketler ve bakiye.
- **CRM:** potansiyel müşteri listesi ve kartı, adayı yeni / mevcut cariye ve satış fırsatına dönüştürme; sürükle-bırak
  satış fırsatı panosu (kaybedilene bırakınca neden sorulur) ve liste görünümü, aşama çubuklu fırsat kartı, fırsattan
  teklif hazırlama; arama / toplantı / görev aktiviteleri (geciken ve bugünkü işler), cari kartında fırsatlar ve
  aktiviteler, gösterge panelinde açık hat, bu ay kazanılan ve kazanma oranı.
- **Masraf ve Harcırah:** "Masraflarım" self-servis ekranı; fişli masraf (döviz ve KDV), günlük harcırah ve km
  ücretli araç kalemleriyle masraf formu, fiş görseli / PDF yükleme, limit üstü ve eksik fiş uyarıları; onaycının
  formu açıp onaylaması veya reddetmesi, finansın kasa / bankadan ödemesi ve geri alması; masraf türleri
  (limit, fiş zorunluluğu, harcırah ve km ücreti), aylık ve türe göre masraf grafikleri.
- **Proje Yönetimi:** proje listesi (ilerleme, kayıtlı süre, bütçe kullanımı, geciken ve bütçesi aşan projeler),
  proje ekibi ve saatlik maliyetler, sürükle-bırak görev panosu, "Görevlerim" ve haftalık "Zaman Çizelgesi"
  self-servis ekranları, proje detayında zaman kayıtları ve projeye bağlı masraflar; masraf formunda proje seçimi.
- **Bordro:** bordro dönemleri (yeni ay hesaplama, yeniden hesaplama, onay, maaş ödemesi ve geri alma), dönem
  detayında personel bazında brüt, SGK, vergi ve net; düzenlenebilir ücret pusulası (eksik gün, fazla mesai,
  prim ve kesinti kalemleri) ve yazdırma; "Bordrolarım" self-servis ekranı; ücretler listesi ve ücret geçmişi
  (personel kartında da "Ücret" sekmesi); yıla göre bordro parametreleri ve gelir vergisi dilimleri.
- **İşe Alım:** iş ilanları (yayınlama, bekletme, kapatma, yeniden açma) ve işe alım hunisi; ilan başına
  sürükle-bırak başvuru hattı; aday havuzu, CV yükleme ve aday profili; mülakat planlama (mülakatçı seçimi,
  süre, yer), "Mülakatlarım" ekranında puan ve tavsiyeyle değerlendirme; teklif verme, kabul / ret / geri
  çekme; kabul edilen adayı tek adımda personele dönüştürme (departman, pozisyon, yönetici ve ilk ücret).
- **Performans ve Eğitim:** yetkinlik kataloğu; değerlendirme dönemi oluşturma, başlatma ve kapatma; dönem
  özeti (tamamlanma, puan dağılımı, departman bazında ortalama); "Değerlendirmelerim" ekranında kendi
  formları ve ekip formları; hedef ekleme, öz değerlendirme, yönetici değerlendirmesi, geri gönderme ve sonucu
  onaylama. Eğitim kataloğu, oturum planlama, katılımcı ekleme, katılım ve puan girişi; "Eğitimlerim"
  ekranında zorunlu sertifikalar, kayda açık oturumlara kaydolma ve geri bildirim; zorunlu eğitim uyum
  matrisi ve personel kartında "Eğitimler" sekmesi.
- **Destek Talepleri:** "Destek Taleplerim" ekranında talep açma, yanıt verme, dosya ekleme, çözümü onaylayıp
  puanlama veya yeniden açma; destek kuyruğunda SLA göstergeleri, trend grafiği, ekip iş yükü ve görünüm /
  öncelik / kategori filtreleri; talep ekranında atama, öncelik ve kategori değişikliği, bilgi isteme,
  çözme, dahili not ve geçmiş; destek ayarlarında kategori, varsayılan sorumlu ve SLA hedefleri.
- **Sözleşmeler:** cari ve personel sözleşmeleri listesi (yürürlükte, bitiyor, bana atanan, taslak, sona eren,
  feshedilen görünümleri; taraf ve tür filtresi), yıllık gelir / gider göstergeleri, 12 aylık bitiş ve yenileme
  grafiği, yaklaşan karar tarihleri; sözleşme ekranında yürürlüğe alma, yenileme, fesih bildirme ve geri alma,
  imzalı sözleşme ekleri ve geçmiş; sözleşme türleri; cari kartında ve personel kartında "Sözleşmeler".
- **Bütçe:** yıla göre şirket ve departman bütçeleri, YBK gider / gelir göstergeleri, departman grafiği ve
  dikkat gerektiren kalemler; bütçe ekranında aylık plan ve gerçekleşen grafiği, kalem bazında YBK sapma ve
  kullanım, kaleme tıklayınca kaynak belgeler (masraf, bordro, alış / satış faturası), 12 aylık plan tablosu
  (kalem ekleme, eşit dağıtma), onaylama ve gerekçeli yeniden açma; bütçe kalemleri ve kategori eşlemesi;
  kira, lisans, reklam gibi gerçekleşenler için bütçe girişleri.
- **Araç ve Filo:** filo panosu (araç sayısı, yıllık maliyet, km başına maliyet, ortalama tüketim, son 12 ay
  maliyet grafiği, süresi dolan / yaklaşan belge ve bakımlar), araç listesi; araç ekranında yıllık özet ve aylık
  km / maliyet grafiği, sürücü zimmeti, devir ve teslim alma, yakıt, bakım ve onarım, muayene ve sigorta, zimmet
  ve km geçmişi sekmeleri; filo geneli yakıt defteri; sürücünün "Araçlarım" ekranından yakıt ve km girişi.
- **Muhasebe:** muhasebe paneli (hazır değerler, ticari alacak ve borç, yıllık net kâr, aylık gelir / gider
  grafiği, muhasebeleşmeyi bekleyen belgeler ve tek tıkla muhasebeleştirme, dönem kilidi); yevmiye defteri
  (kaynak, durum ve tarih filtresi, kaynak belgeye bağlantı); aranabilir hesap ve cari seçimli fiş formu
  (borç / alacak farkı, dengeleyen satır önerisi, taslak ve kesinleştirme); fiş detayında kesinleştirme ve
  ters kayıt; Tekdüzen hesap planı (alt hesap ekleme, bakiyeler); muavin defter (yürüyen bakiye, cari
  filtresi); mizan, bilanço ve gelir tablosu (Excel / PDF dışa aktarma).
- **Satın Alma:** personelin ihtiyaç talebi (onay akışıyla), tedarikçi teklifleri ve karşılaştırma tablosu, teklifi siparişe
  dönüştürme, sipariş onayı, kısmi mal kabul (lot / seri numarasıyla stoğa giriş), üç yönlü eşleştirmeli alış faturası
  (sipariş, teslim alınan ve faturalanan miktar), vadesi geçen faturalar, yazdırılabilir belgeler.
- **Satış:** müşteri teklifi ve siparişe dönüştürme, onayda kredi limiti kontrolü ve stok rezervasyonu, depodan lot /
  seri numarası seçerek kısmi sevk irsaliyesi, sevk edilen miktar kadar satış faturası, faturaya bağlı satış iadesi;
  ürün seçicide rezerve stok düşülmüş kullanılabilir miktar.
- **Finans:** kasa ve banka hesapları ve hesap hareketleri, tahsilat / ödeme (nakit, banka, çek, senet) ve faturalara
  otomatik veya seçmeli kapama, çek / senet portföyü (bankaya verme, tahsil, ciro, karşılıksız, kendi çekimizi ödeme),
  yaşlandırma raporu (0-30 / 31-60 / 61-90 / 90+ gün), nakit pozisyonu; hepsi Excel / PDF olarak aktarılabilir.
- **Raporlar:** satış ve alış analizi (aylık, cari veya ürün bazında; KDV, iade ve net tutarlar), nakit akışı
  (hesap seçimi, dönem başı / sonu bakiye); dönem hazır seçimleri ve filtreler URL'de saklanır, paylaşılabilir;
  recharts ile aylık seyir ve ilk 10 grafikleri.
- **Barkod ve QR okutma:** USB okuyucu (klavye gibi yazar) veya tarayıcı destekliyorsa telefon / bilgisayar kamerası
  (yerleşik `BarcodeDetector` API'si, ek kütüphane yok).
- **Her listede:** sunucu taraflı sayfalama, arama ve sıralama; sütun gizleme; filtrelenmiş tüm kayıtları Excel veya PDF olarak
  dışa aktarma (PDF kütüphanesi ilk kullanımda yüklenir).
- **Yetkiye duyarlı arayüz:** menü, butonlar ve sayfalar kullanıcının izinlerine göre gösterilir; yetkisiz adreslere girişte
  `/forbidden` sayfasına yönlendirilir.

## Mimari

```
src/
  app/          router, provider'lar, yerleşim (sidebar, üst bar), menü tanımı
  routes/       TanStack Router dosya tabanlı rotalar (yetki kontrolü beforeLoad'da)
  features/     iş alanı başına sayfalar, formlar, bileşenler (hr, assets, inventory, ...)
  shared/       ui (shadcn/ui), ortak bileşenler (DataTable, ConfirmDialog, InfoCard), hook'lar, yardımcılar
  api/          axios istemcisi + Orval ile üretilen tipli hook'lar
  i18n/         tr / en çeviri dosyaları (tip güvenli anahtarlar)
```

- **Tipli API sözleşmesi:** Backend'in OpenAPI şemasından [Orval](https://orval.dev) ile TanStack Query hook'ları ve
  TypeScript modelleri üretilir (`pnpm api:generate`). API değişince derleme hatası olarak yakalanır.
- **Sunucu durumu** yalnızca TanStack Query'de; oturum ve tema gibi istemci durumu Zustand'da tutulur.
- **Oturum:** access token bellekte, refresh token HttpOnly cookie'de; süresi dolan token'lar istek kuyruğuyla tek seferde yenilenir.
- **Formlar:** React Hook Form + zod; doğrulama mesajları çevirilerden gelir.
- **Para ve miktar:** API'den string gelen ondalık değerler `formatMoney` / `formatQuantity` ile yerel biçimde gösterilir.
- **Yazdırma:** zimmet tutanağı ve stok fişi normal sayfalardır; `print:` stilleriyle tarayıcıdan PDF alınır.

## Hızlı başlangıç

Gereksinimler: Node 22 LTS, pnpm 9 ve çalışan bir [API](https://github.com/hamzamaral/enterprise-pulse-api#hızlı-başlangıç).

```bash
git clone https://github.com/hamzamaral/enterprise-pulse-web.git web && cd web
cp .env.example .env
pnpm install
pnpm dev              # http://localhost:5173 (/api ve /socket.io istekleri API'ye proxy'lenir)
```

| Rol               | E-posta                        | Şifre          |
| ----------------- | ------------------------------ | -------------- |
| Sistem yöneticisi | `admin@enterprisepulse.dev`    | `Admin123!`    |
| Müdür             | `manager@enterprisepulse.dev`  | `Manager123!`  |
| Personel          | `employee@enterprisepulse.dev` | `Employee123!` |

Giriş ekranındaki demo hesap butonları bilgileri otomatik doldurur.

## Komutlar

| Komut                                                | Açıklama                                             |
| ---------------------------------------------------- | ---------------------------------------------------- |
| `pnpm dev`                                           | Geliştirme sunucusu                                  |
| `pnpm build` / `pnpm preview`                        | Üretim derlemesi / önizleme                          |
| `pnpm lint` / `pnpm format:check` / `pnpm typecheck` | Kod kalitesi kontrolleri                             |
| `pnpm test`                                          | Birim ve bileşen testleri (Vitest + Testing Library) |
| `pnpm e2e`                                           | Tarayıcı testleri (Playwright, API çalışıyor olmalı) |
| `pnpm api:generate`                                  | OpenAPI şemasından API istemcisini yeniden üret      |

## CI ve dağıtım

- **GitHub Actions:** lint, format, tip kontrolü, testler, üretim derlemesi ve Docker imajı; Playwright testleri elle tetiklenir.
- **Docker:** çok aşamalı derleme, statik dosyalar Nginx ile sunulur (`nginx.conf`, SPA yönlendirmesi ve API proxy'si).
- Commit mesajları [Conventional Commits](https://www.conventionalcommits.org) biçimindedir; Husky, commitlint ve
  lint-staged ile denetlenir.

## Teknolojiler

React 19 · TypeScript · Vite · TanStack Router · TanStack Query · TanStack Table · shadcn/ui (Radix) · Tailwind CSS 4 ·
React Hook Form · zod · Orval · axios · Zustand · i18next · Socket.IO · date-fns · lucide-react · Vitest · Testing Library · Playwright · Docker / Nginx
