# NSFW Görsel Analiz API

Bu proje, NSFW (Not Safe For Work) görüntüleri sınıflandırmak için TensorFlow.js ve NSFWJS kütüphanesini kullanan bir Node.js Express API'sidir. API, token bazlı bir yetkilendirme sistemi ve admin paneline sahiptir.

## Özellikler

- URL'den görsel sınıflandırma
- Dosya yükleme ile görsel sınıflandırma
- Toplu URL işleme özelliği
- Farklı model türleri desteği (MobileNetV2, MobileNetV2Mid, InceptionV3)
- API anahtarı yönetimi
- Token bazlı kullanım sınırlaması (her görsel 1 token)
- IP bazlı hız sınırlaması (15dk'da 15 istek)
- Admin paneli
- Ayrıntılı kullanım istatistikleri

## Kurulum

1. Repoyu klonlayın:
```bash
git clone https://github.com/kullanici/nsfw-model.git
cd nsfw-model
```

2. Bağımlılıkları yükleyin:
```bash
npm install
```

3. `.env` dosyasını ayarlayın:
```
# Uygulama Ayarları
PORT=3000
NODE_ENV=development

# Veritabanı Bilgileri
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=nsfw_api

# JWT ve Oturum Bilgileri
JWT_SECRET=gizli_anahtar_buraya_yazin
SESSION_SECRET=oturum_gizli_anahtari_buraya_yazin

# Admin Şifresi
ADMIN_PASSWORD=admin123
```

4. MySQL veritabanını oluşturun:
```bash
mysql -u root -p < db/schema.sql
```

5. Sunucuyu başlatın:
```bash
npm start
```

Sunucu varsayılan olarak 3000 portunda çalışacaktır.

## API Kullanımı

### URL ile Sınıflandırma

GET isteği ile:
```
http://localhost:3000/predict?url=https://example.com/image.jpg&model=MobileNetV2
```

### Dosya Yükleme ile Sınıflandırma

```bash
curl -X POST "http://localhost:3000/predict?model=MobileNetV2" \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "image=@/path/to/your/image.jpg"
```

### Toplu URL İşleme (Batch Predict)

POST isteği ile birden çok URL'i işleyebilirsiniz:

```bash
curl -X POST "http://localhost:3000/batch_predict" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "urls": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg",
      "https://example.com/image3.jpg"
    ],
    "model": "MobileNetV2"
  }'
```

### Kullanım Bilgisi

Kalan token miktarınızı görüntülemek için:

```bash
curl "http://localhost:3000/usage_info" \
  -H "X-API-Key: YOUR_API_KEY"
```

## Admin Paneli

Admin paneline erişmek için şu URL'i kullanın:

```
http://localhost:3000/admin
```

Admin panelinde şunları yapabilirsiniz:
- API anahtarı oluşturma ve yönetme
- Kullanım istatistiklerini görüntüleme
- IP limitleri yönetimi
- Genel sistem istatistiklerini inceleme

## Token Sistemi

Her görsel analizi 1 token kullanır.
- API anahtarınız olmadan sınırlı sayıda istek yapabilirsiniz (IP başına aylık 100 token)
- Kayıtlı API anahtarları ile aylık belirlenmiş token limitine kadar istek yapabilirsiniz (varsayılan: 1000 token)
- Sınırsız olarak işaretlenen API anahtarları için token limiti yoktur

## Model Tipleri

API şu model tiplerini destekler:
- `MobileNetV2` (varsayılan): Hızlı, hafif model
- `MobileNetV2Mid`: Orta seviyede doğruluk/performans dengesi
- `InceptionV3`: Daha yüksek doğruluk ancak daha yavaş işlem

## Sistem Gereksinimleri

- Node.js (v14+)
- MySQL (v5.7+)
- Yeterli disk alanı (model dosyaları için ~100MB)

## Çıktı Örnekleri

### Tekli Sınıflandırma Yanıtı
```json
{
  "model": "MobileNetV2",
  "predictions": [
    {
      "className": "Drawing",
      "probability": 0.01
    },
    {
      "className": "Hentai",
      "probability": 0.02
    },
    {
      "className": "Neutral",
      "probability": 0.95
    },
    {
      "className": "Porn",
      "probability": 0.01
    },
    {
      "className": "Sexy",
      "probability": 0.01
    }
  ]
}
```

### Toplu Sınıflandırma Yanıtı
```json
{
  "model": "MobileNetV2",
  "results": [
    {
      "url": "https://example.com/image1.jpg",
      "predictions": [
        {"className": "Drawing", "probability": 0.01},
        {"className": "Hentai", "probability": 0.02},
        {"className": "Neutral", "probability": 0.95},
        {"className": "Porn", "probability": 0.01},
        {"className": "Sexy", "probability": 0.01}
      ],
      "error": null
    },
    {
      "url": "https://example.com/image2.jpg",
      "predictions": [
        {"className": "Drawing", "probability": 0.02},
        {"className": "Hentai", "probability": 0.01},
        {"className": "Neutral", "probability": 0.94},
        {"className": "Porn", "probability": 0.02},
        {"className": "Sexy", "probability": 0.01}
      ],
      "error": null
    },
    {
      "url": "https://invalid-url.com/image.jpg",
      "predictions": null,
      "error": "Request failed with status code 404"
    }
  ]
}
``` 