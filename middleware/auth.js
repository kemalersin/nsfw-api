const { pool } = require('../db/database');
require('dotenv').config();

// Token hesaplama fonksiyonu - görsel başına 1 token
function calculateTokens() {
  return 1; // Her görsel analizi 1 token kullanır
}

// API key bilgilerini veritabanından al
async function getApiKeyInfo(apiKey) {
  try {
    const [rows] = await pool.query('SELECT * FROM api_keys WHERE api_key = ?', [apiKey]);
    
    if (rows.length === 0) {
      return null;
    }
    
    const keyInfo = rows[0];
    
    // Otomatik reset kontrolü - 30 günden fazla geçtiyse token kullanımını sıfırla
    if (keyInfo.auto_reset && keyInfo.last_reset_date) {
      const currentDate = new Date();
      const lastResetDate = new Date(keyInfo.last_reset_date);
      const daysDiff = Math.floor((currentDate - lastResetDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 30) {
        await pool.query(
          'UPDATE api_keys SET tokens_used = 0, last_reset_date = NOW() WHERE id = ?',
          [keyInfo.id]
        );
        keyInfo.tokens_used = 0;
        keyInfo.last_reset_date = currentDate;
      }
    }
    
    return keyInfo;
  } catch (error) {
    console.error('API key bilgisi alınırken hata:', error);
    return null;
  }
}

// İstemci IP adresini alma
function getClientIp(req) {
  /**
   * İstemcinin gerçek IP adresini döndürür.
   * 
   * Proxy sunucuları, load balancer'lar veya reverse proxy arkasında çalışan
   * uygulamalar için gerçek istemci IP'sini tespit etmeye çalışır.
   * 
   * Öncelik sırası:
   * 1. CF-Connecting-IP header'ı (Cloudflare)
   * 2. True-Client-IP header'ı (Cloudflare alternatif)
   * 3. X-Forwarded-For header'ı (proxy sunucular tarafından eklenir)
   * 4. X-Real-IP header'ı (Nginx gibi reverse proxy'ler tarafından eklenir)
   * 5. X-Client-IP header'ı (bazı proxy'ler tarafından eklenir)
   * 6. req.connection.remoteAddress (doğrudan bağlantılarda)
   * 
   * X-Forwarded-For birden fazla IP içeriyorsa, en baştaki IP (gerçek istemci IP'si) alınır.
   */
  
  // Tüm olası header'ları kontrol et
  const headers = [
    'cf-connecting-ip',  // Cloudflare
    'true-client-ip',    // Cloudflare alternatif
    'x-forwarded-for',   // Standart proxy header'ı
    'x-real-ip',         // Nginx
    'x-client-ip',       // Bazı proxy'ler
    'forwarded'          // RFC 7239 standardı
  ];
  
  let ip;
  
  // Header'ları öncelik sırasına göre kontrol et
  for (const header of headers) {
    const headerValue = req.headers[header];
    if (headerValue) {
      // X-Forwarded-For header'ı virgülle ayrılmış IP listesi içerebilir
      if (header === 'x-forwarded-for' && headerValue.includes(',')) {
        ip = headerValue.split(',')[0].trim();
      } else {
        ip = headerValue.trim();
      }
      
      if (ip) {
        break;
      }
    }
  }
  
  // Hiçbir header bulunamazsa doğrudan bağlantı IP'sini kullan
  if (!ip) {
    ip = (req.socket && req.socket.remoteAddress) || 
         (req.connection && req.connection.remoteAddress) || 
         req.ip || 
         '0.0.0.0';  // Hiçbir şekilde IP bulunamazsa varsayılan
  }

  return ip;
}

// IP'nin izin verilen listede olup olmadığını kontrol et
function isIpAllowed(clientIp, unlimitedIps) {
  if (!unlimitedIps) {
    return false;
  }
  
  const ipList = unlimitedIps.split(',').map(ip => ip.trim());
  return ipList.includes(clientIp);
}

// IP bazlı bilgileri al veya oluştur
async function getOrCreateIpInfo(ipAddress) {
  try {
    const [rows] = await pool.query('SELECT * FROM ip_rate_limits WHERE ip_address = ?', [ipAddress]);
    
    if (rows.length > 0) {
      const ipInfo = rows[0];
      
      // 30 günden fazla geçtiyse reset kontrol et
      if (ipInfo.last_reset_date) {
        const currentDate = new Date();
        const lastResetDate = new Date(ipInfo.last_reset_date);
        const daysDiff = Math.floor((currentDate - lastResetDate) / (1000 * 60 * 60 * 24));
        
        if (daysDiff >= 30) {
          await pool.query(
            'UPDATE ip_rate_limits SET tokens_used = 0, last_reset_date = NOW() WHERE id = ?',
            [ipInfo.id]
          );
          ipInfo.tokens_used = 0;
          ipInfo.last_reset_date = currentDate;
        }
      }
      
      return ipInfo;
    }
    
    // IP bilgisi yoksa oluştur
    const [result] = await pool.query(
      'INSERT INTO ip_rate_limits (ip_address, monthly_token_limit, last_reset_date) VALUES (?, ?, NOW())',
      [ipAddress, 100]
    );
    
    const [newIpInfo] = await pool.query('SELECT * FROM ip_rate_limits WHERE id = ?', [result.insertId]);
    return newIpInfo[0];
  } catch (error) {
    console.error('IP bilgisi alınırken hata:', error);
    return null;
  }
}

// Token kullanımını güncelle
async function updateTokenUsage(apiKeyId, tokensUsed) {
  try {
    await pool.query(
      'UPDATE api_keys SET tokens_used = tokens_used + ? WHERE id = ?',
      [tokensUsed, apiKeyId]
    );
    console.log(`Token kullanımı güncellendi: api_key_id=${apiKeyId}, tokens_used=${tokensUsed}`);
  } catch (error) {
    console.error('Token kullanımı güncellenirken hata:', error);
  }
}

// IP token kullanımını güncelle
async function updateIpTokenUsage(ipId, tokensUsed) {
  try {
    await pool.query(
      'UPDATE ip_rate_limits SET tokens_used = tokens_used + ? WHERE id = ?',
      [tokensUsed, ipId]
    );
    console.log(`IP token kullanımı güncellendi: ip_id=${ipId}, tokens_used=${tokensUsed}`);
  } catch (error) {
    console.error('IP token kullanımı güncellenirken hata:', error);
  }
}

/**
 * API kullanımını logla
 * @param {string} apiKeyId - API key ID
 * @param {string} requestIp - İstek IP adresi
 * @param {string} endpoint - Endpoint
 * @param {string} url - İstek URL'i
 * @param {number} tokensUsed - Kullanılan token sayısı
 * @param {boolean} isSuccessful - İsteğin başarılı olup olmadığı
 * @param {string} errorMessage - Hata mesajı (başarısız ise)
 */
const logApiUsage = async (apiKeyId, requestIp, endpoint, url, tokensUsed, isSuccessful, errorMessage = null) => {
  try {
    await pool.query(
      'INSERT INTO api_usage_logs (api_key_id, request_ip, endpoint, url, tokens_used, is_successful, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [apiKeyId, requestIp, endpoint, url, tokensUsed, isSuccessful, errorMessage]
    );
  } catch (error) {
    console.error('API kullanımı loglanırken hata:', error);
  }
};

// IP kullanımını logla
async function logIpRequest(ipAddress, endpoint, tokensUsed, isSuccessful, errorMessage = null) {
  try {
    await pool.query(
      'INSERT INTO api_usage_logs (api_key_id, request_ip, endpoint, tokens_used, is_successful, error_message) VALUES (NULL, ?, ?, ?, ?, ?)',
      [ipAddress, endpoint, tokensUsed, isSuccessful, errorMessage]
    );
  } catch (error) {
    console.error('IP kullanımı loglanırken hata:', error);
  }
}

// IP istek sayısını güncelle
async function updateIpRequestCount(ipId) {
  try {
    await pool.query(
      'UPDATE ip_rate_limits SET request_count = request_count + 1, last_request_time = NOW() WHERE id = ?',
      [ipId]
    );
  } catch (error) {
    console.error('IP istek sayısı güncellenirken hata:', error);
  }
}

// IP istek sayısını sıfırla
async function resetIpRequestCount(ipId) {
  try {
    await pool.query(
      'UPDATE ip_rate_limits SET request_count = 0 WHERE id = ?',
      [ipId]
    );
  } catch (error) {
    console.error('IP istek sayısı sıfırlanırken hata:', error);
  }
}

// IP'nin istek yapabilirliğini kontrol et (15dk içinde 15 istek limiti)
async function canIpMakeRequest(ipInfo) {
  if (!ipInfo || !ipInfo.last_request_time) {
    return true;
  }
  
  const lastRequest = new Date(ipInfo.last_request_time);
  const now = new Date();
  const diffInSeconds = (now - lastRequest) / 1000;
  
  // 15 dakika (900 saniye) geçtiyse istek sayısını sıfırla
  if (diffInSeconds > 900) {
    await resetIpRequestCount(ipInfo.id);
    return true;
  }
  
  // 15 dakika içinde 15 istekten az yapmışsa izin ver
  return ipInfo.request_count < 15;
}

// API Key gerektiren middleware
async function requireApiKey(req, res, next) {
  try {
    // Admin kontrolü
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedAdminPassword = req.headers['admin-password'];
    
    if (adminPassword && providedAdminPassword === adminPassword) {
      // Admin olarak işaretle
      req.isAdmin = true;
      req.isUnlimited = true;
      req.usingApiKey = false;
      req.adminRequest = true;
      return next();
    }
    
    // API Key kontrolü
    const apiKey = req.headers['x-api-key'];
    const clientIp = getClientIp(req);
    
    // API Key varsa kontrol et
    if (apiKey) {
      const keyInfo = await getApiKeyInfo(apiKey);
      
      if (!keyInfo) {
        return res.status(401).json({ error: 'Geçersiz API anahtarı' });
      }
      
      // Sınırsız API Key veya izin verilen IP adresi kontrolü
      const isUnlimited = keyInfo.is_unlimited || isIpAllowed(clientIp, keyInfo.unlimited_ips);
      
      // Kullanım bilgilerini req nesnesine kaydet
      req.apiKeyId = keyInfo.id;
      req.isUnlimited = isUnlimited;
      req.tokensUsed = keyInfo.tokens_used;
      req.monthlyTokenLimit = keyInfo.monthly_token_limit;
      req.usingApiKey = true;
      req.adminRequest = false;
      req.clientIp = clientIp;
    } 
    // API Key yoksa IP bazlı sınırlamaları kontrol et
    else {
      const ipInfo = await getOrCreateIpInfo(clientIp);
      
      if (!ipInfo) {
        return res.status(500).json({ error: 'IP adresi bilgisi alınamadı' });
      }
      
      // IP adresinin istek limitini kontrol et
      const canMakeRequest = await canIpMakeRequest(ipInfo);
      if (!canMakeRequest) {
        return res.status(429).json({
          error: 'Hız sınırına ulaşıldı',
          message: '15 dakika içinde en fazla 15 istek yapabilirsiniz'
        });
      }
      
      // Kullanım bilgilerini req nesnesine kaydet
      req.ipId = ipInfo.id;
      req.isUnlimited = false;
      req.tokensUsed = ipInfo.tokens_used;
      req.monthlyTokenLimit = ipInfo.monthly_token_limit;
      req.usingApiKey = false;
      req.clientIp = clientIp;
      req.adminRequest = false;
    }
    
    next();
  } catch (error) {
    console.error('API yetkilendirmede hata:', error);
    res.status(500).json({ error: 'Yetkilendirme hatası' });
  }
}

// Admin yetkisi gerektiren middleware
function adminRequired(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const providedAdminPassword = req.headers['admin-password'];
  
  if (adminPassword && providedAdminPassword === adminPassword) {
    return next();
  }
  
  // Oturum kontrolü (web arayüzü için)
  if (req.session && req.session.adminLoggedIn) {
    return next();
  }
  
  // API veya JSON yanıtı için
  if (req.xhr || req.headers.accept === 'application/json') {
    return res.status(401).json({ error: 'Bu endpoint\'e erişim için admin yetkisi gerekiyor.' });
  }
  
  // Web arayüzü için
  return res.status(401).json({ error: 'Yetkisiz erişim. Admin girişi yapmalısınız.' });
}

module.exports = {
  calculateTokens,
  getApiKeyInfo,
  getClientIp,
  isIpAllowed,
  getOrCreateIpInfo,
  updateTokenUsage,
  updateIpTokenUsage,
  logApiUsage,
  logIpRequest,
  updateIpRequestCount,
  canIpMakeRequest,
  requireApiKey,
  adminRequired
}; 