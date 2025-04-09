const { pool } = require('../db/database');
const crypto = require('crypto');
require('dotenv').config();

// Admin paneli sayfası
const adminPanel = (req, res) => {
  res.render('admin', { 
    title: 'Admin Paneli',
    loggedIn: req.session.adminLoggedIn || false,
    error: req.query.error ? 'Yetkisiz erişim. Lütfen tekrar giriş yapın.' : null 
  });
};

// Admin giriş işlemi
const adminLogin = (req, res) => {
  const password = req.body.password;
  const adminPassword = process.env.ADMIN_PASSWORD;
  
  if (password === adminPassword) {
    req.session.adminLoggedIn = true;
    return res.redirect('/admin');
  }
  
  res.render('admin', { 
    title: 'Admin Paneli',
    loggedIn: false,
    error: 'Geçersiz şifre!' 
  });
};

// Admin çıkış işlemi
const adminLogout = (req, res) => {
  req.session.adminLoggedIn = false;
  res.redirect('/admin');
};

// API anahtarlarını listele
const listApiKeys = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM api_keys ORDER BY created_at DESC');
    res.json({ api_keys: rows });
  } catch (error) {
    console.error('API anahtarları listelenirken hata:', error);
    res.status(500).json({ error: 'API anahtarları alınırken bir hata oluştu.' });
  }
};

// Belirli bir API anahtarı bilgisini getir
const getApiKey = async (req, res) => {
  try {
    const keyId = req.params.keyId;
    const [rows] = await pool.query('SELECT * FROM api_keys WHERE id = ?', [keyId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'API anahtarı bulunamadı.' });
    }
    
    res.json({ api_key: rows[0] });
  } catch (error) {
    console.error('API anahtarı bilgileri alınırken hata:', error);
    res.status(500).json({ error: 'API anahtarı bilgileri alınırken bir hata oluştu.' });
  }
};

// API anahtarını sil
const deleteApiKey = async (req, res) => {
  try {
    const keyId = req.params.keyId;
    const [result] = await pool.query('DELETE FROM api_keys WHERE id = ?', [keyId]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API anahtarı bulunamadı.' });
    }
    
    res.json({ message: 'API anahtarı başarıyla silindi.' });
  } catch (error) {
    console.error('API anahtarı silinirken hata:', error);
    res.status(500).json({ error: 'API anahtarı silinirken bir hata oluştu.' });
  }
};

// Yeni API anahtarı oluştur
const createApiKey = async (req, res) => {
  try {
    const { description, monthly_token_limit, is_unlimited, auto_reset, unlimited_ips } = req.body;
    
    // 32 karakter uzunluğunda yeni bir API anahtarı oluştur
    const apiKey = crypto.randomBytes(16).toString('hex');
    const currentDateTime = new Date();
    
    const [result] = await pool.query(
      'INSERT INTO api_keys (api_key, description, monthly_token_limit, is_unlimited, unlimited_ips, auto_reset, tokens_used, last_reset_date) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
      [apiKey, description || '', monthly_token_limit || 1000, is_unlimited || false, unlimited_ips || '', auto_reset || true, currentDateTime]
    );
    
    res.status(201).json({ 
      message: 'API anahtarı başarıyla oluşturuldu.', 
      apiKey,
      id: result.insertId 
    });
  } catch (error) {
    console.error('API anahtarı oluşturulurken hata:', error);
    res.status(500).json({ error: 'API anahtarı oluşturulurken bir hata oluştu.' });
  }
};

// API anahtarını güncelle
const updateApiKey = async (req, res) => {
  try {
    const keyId = req.params.keyId;
    const { description, monthly_token_limit, is_unlimited, auto_reset, unlimited_ips } = req.body;
    
    // Güncellenecek alanları ve değerleri hazırla
    const updateFields = [];
    const updateValues = [];
    
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    
    if (monthly_token_limit !== undefined) {
      updateFields.push('monthly_token_limit = ?');
      updateValues.push(monthly_token_limit);
    }
    
    if (is_unlimited !== undefined) {
      updateFields.push('is_unlimited = ?');
      updateValues.push(is_unlimited);
    }
    
    if (auto_reset !== undefined) {
      updateFields.push('auto_reset = ?');
      updateValues.push(auto_reset);
    }
    
    if (unlimited_ips !== undefined) {
      updateFields.push('unlimited_ips = ?');
      updateValues.push(unlimited_ips);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan belirtilmedi.' });
    }
    
    // SQL sorgusunu oluştur
    const sql = `UPDATE api_keys SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(keyId);
    
    const [result] = await pool.query(sql, updateValues);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'API anahtarı bulunamadı.' });
    }
    
    res.json({ message: 'API anahtarı başarıyla güncellendi.' });
  } catch (error) {
    console.error('API anahtarı güncellenirken hata:', error);
    res.status(500).json({ error: 'API anahtarı güncellenirken bir hata oluştu.' });
  }
};

// IP kullanım bilgilerini listele
const listIpUsage = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM ip_rate_limits ORDER BY request_count DESC');
    res.json({ ip_usage: rows });
  } catch (error) {
    console.error('IP kullanım bilgileri listelenirken hata:', error);
    res.status(500).json({ error: 'IP kullanım bilgileri alınırken bir hata oluştu.' });
  }
};

// IP limitlerini sıfırla
const resetIpLimits = async (req, res) => {
  try {
    const ipAddress = req.params.ipAddress;
    const currentDateTime = new Date();
    
    const [result] = await pool.query(
      'UPDATE ip_rate_limits SET tokens_used = 0, request_count = 0, last_reset_date = ? WHERE ip_address = ?',
      [currentDateTime, ipAddress]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'IP adresi bulunamadı.' });
    }
    
    res.json({ message: `${ipAddress} için kullanım limitleri başarıyla sıfırlandı.` });
  } catch (error) {
    console.error('IP limitleri sıfırlanırken hata:', error);
    res.status(500).json({ error: 'IP limitleri sıfırlanırken bir hata oluştu.' });
  }
};

// Kullanım özetini al
const usageSummary = async (req, res) => {
  try {
    // Genel istatistikler
    const summary = {
      total_Api_keys: 0,
      total_ips: 0,
      today_requests: 0,
      monthly_requests: 0,
      top_api_keys: [],
      top_ips: []
    };
    
    // Toplam API anahtarı sayısı
    const [apiKeyCount] = await pool.query('SELECT COUNT(*) as count FROM api_keys');
    summary.total_api_keys = apiKeyCount[0].count;
    
    // Toplam IP adresi sayısı
    const [ipCount] = await pool.query('SELECT COUNT(*) as count FROM ip_rate_limits');
    summary.total_ips = ipCount[0].count;
    
    // Bugünkü istek sayısı
    const [todayCount] = await pool.query('SELECT COUNT(*) as count FROM api_usage_logs WHERE DATE(created_at) = CURDATE()');
    summary.today_requests = todayCount[0].count;
    
    // Son 30 gündeki istek sayısı
    const [monthlyCount] = await pool.query('SELECT COUNT(*) as count FROM api_usage_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    summary.monthly_requests = monthlyCount[0].count;
    
    // En çok kullanılan API anahtarları (top 5)
    const [topApiKeys] = await pool.query(`
      SELECT api_key_id, COUNT(*) as usage_count 
      FROM api_usage_logs 
      WHERE api_key_id IS NOT NULL
      GROUP BY api_key_id 
      ORDER BY usage_count DESC 
      LIMIT 5
    `);
    summary.top_api_keys = topApiKeys;
    
    // En çok istek yapan IP'ler (top 5)
    const [topIps] = await pool.query(`
      SELECT request_ip, COUNT(*) as usage_count 
      FROM api_usage_logs 
      GROUP BY request_ip 
      ORDER BY usage_count DESC 
      LIMIT 5
    `);
    summary.top_ips = topIps;
    
    res.json(summary);
  } catch (error) {
    console.error('Kullanım özeti alınırken hata:', error);
    res.status(500).json({ error: 'Kullanım özeti alınırken bir hata oluştu.' });
  }
};

module.exports = {
  adminPanel,
  adminLogin,
  adminLogout,
  listApiKeys,
  getApiKey,
  deleteApiKey,
  createApiKey,
  updateApiKey,
  listIpUsage,
  resetIpLimits,
  usageSummary
}; 