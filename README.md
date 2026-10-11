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

|                                                                 |                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ![Giriş](docs/screenshots/login.png)                            | ![Stok hareket fişi](docs/screenshots/stock-movement-form.png)           |
| **Giriş:** demo hesaplar, iki adımlı doğrulama, şifre sıfırlama | **Stok fişi:** lot ve son kullanma tarihi, seri numaraları, anlık toplam |
| ![Stok kartı](docs/screenshots/stock-card.png)                  | ![Demirbaş](docs/screenshots/asset-detail.png)                           |
| **Stok kartı:** her hareketin bakiyesi ve birim maliyeti        | **Demirbaş kartı:** QR etiket, zimmet durumu, net defter değeri          |
| ![Amortisman](docs/screenshots/asset-depreciation.png)          | ![Organizasyon şeması](docs/screenshots/org-chart.png)                   |
| **Amortisman tablosu:** yıllık ve birikmiş amortisman           | **Organizasyon şeması:** yönetici hiyerarşisi                            |
| ![Puantaj](docs/screenshots/timesheet.png)                      | ![Vardiya planı](docs/screenshots/shift-plan.png)                        |
| **Puantaj:** geç kalma, devamsızlık, izin ve fazla mesai        | **Vardiya planı:** haftalık plan, gece vardiyası, önceki haftayı kopyala |
| ![Demirbaş sayımı](docs/screenshots/asset-count.png)            | ![Gösterge paneli](docs/screenshots/dashboard.png)                       |
| **Demirbaş sayımı:** QR / kamera ile okutma, fark raporu        | **Gösterge paneli:** yetkiye göre KPI'lar, kritik stok                   |

## Özellikler

- **Platform:** giriş, iki adımlı doğrulama (TOTP), şirket ve şube değiştirme, kullanıcı / rol / izin yönetimi,
  denetim kaydı, Socket.IO ile anlık bildirimler, onay kutusu, ayarlar (para birimi, kur, KDV, birim, numaralandırma, onay akışları).
- **Gösterge paneli:** kullanıcının yetkilerine göre İK, zimmet ve stok KPI'ları, kritik stok listesi; personel için
  kalan izin hakkı ve onay bekleyen zimmetler.
- **İnsan Kaynakları:** personel kartı, departman ve pozisyonlar, organizasyon şeması, izin talebi ve çok adımlı onay,
  "İzinlerim" ve "Mesaim" (giriş-çıkış) self-servis ekranları, aylık puantaj çizelgesi (İK düzeltmesi, Excel'e aktarma),
  vardiya tanımları ve haftalık vardiya planı.
- **Zimmet ve Demirbaş:** demirbaş kartı, QR etiket, zimmet / iade / devir, yazdırılabilir zimmet tutanağı ve elektronik onay,
  bakım kaydı, amortisman tablosu, QR ile demirbaş sayımı ve yazdırılabilir fark raporu, "Zimmetlerim" self-servis ekranı.
- **Stok ve Depo:** stok durumu ve kritik stok filtresi, ürün ve varyantlar, stok kartı, lot ve seri numaraları,
  giriş / çıkış / transfer / düzeltme fişleri, yazdırılabilir fiş, barkod okutarak stok sayımı, depo ve kategori ayarları.
- **Barkod ve QR okutma:** USB okuyucu (klavye gibi yazar) veya tarayıcı destekliyorsa telefon / bilgisayar kamerası
  (yerleşik `BarcodeDetector` API'si, ek kütüphane yok).
- **Her listede:** sunucu taraflı sayfalama, arama ve sıralama; sütun gizleme; filtrelenmiş tüm kayıtları Excel'e aktarma.
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
