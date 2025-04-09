const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const { initDb } = require('./db/database');
const { loadModel } = require('./controllers/nsfwController');
require('dotenv').config();

// Express app oluştur
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session için middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'gizli_anahtar',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 1 gün
  }
}));

// Admin varlıklarını korumak için middleware
app.use((req, res, next) => {
  // Sadece admin.js dosyasına erişimi kontrol et
  if (req.path === '/js/admin.js') {
    // Admin girişi yapılmamışsa erişimi reddet
    if (!req.session.adminLoggedIn) {
      return res.status(403).json({ error: 'Yetkisiz erişim' });
    }
  }
  next();
});

// Statik dosyaları sunma
app.use(express.static('public'));

// View engine ayarları
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Route'ları dahil et
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');

app.use('/', indexRoutes);
app.use('/admin', adminRoutes);

// Sunucuyu başlat
async function startServer() {
  try {
    // Veritabanını hazırla
    await initDb();
    console.log('Veritabanı başarıyla başlatıldı');
    
    // Varsayılan NSFW modeli yükle
    await loadModel("MobileNetV2");
    
    // Sunucuyu başlat
    app.listen(port, () => {
      console.log(`Sunucu ${port} portunda çalışıyor`);
    });
  } catch (error) {
    console.error('Sunucu başlatılırken hata:', error);
    process.exit(1);
  }
}

// Sunucuyu başlat
startServer(); 