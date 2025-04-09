const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const util = require('util');
require('dotenv').config();

// MySQL bağlantı havuzu oluştur
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'nsfw_api',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Veritabanı şemasını oluştur
async function createSchema() {
  try {
    const conn = await pool.getConnection();
    console.log('Veritabanı bağlantısı başarılı');

    // Schema SQL dosyasını oku
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // SQL komutlarını ayrı ayrı çalıştır
    const sqlStatements = schemaSql.split(';').filter(stmt => stmt.trim() !== '');
    
    for (const stmt of sqlStatements) {
      if (stmt.trim()) {
        await conn.query(stmt);
      }
    }

    console.log('Veritabanı şeması oluşturuldu veya güncellendi');
    conn.release();
  } catch (error) {
    console.error('Veritabanı şeması oluşturulurken hata:', error);
    throw error;
  }
}

// Sistem başlangıcında şemayı kontrol et
async function initDb() {
  try {
    await createSchema();
    console.log('Veritabanı başarıyla hazırlandı');
  } catch (err) {
    console.error('Veritabanı hazırlanırken hata oluştu:', err);
    process.exit(1);
  }
}

module.exports = {
  pool,
  initDb
}; 