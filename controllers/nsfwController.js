const axios = require('axios');
const tf = require('@tensorflow/tfjs-node');
const nsfw = require('nsfwjs');
const path = require('path');
const {
  calculateTokens,
  updateTokenUsage,
  updateIpTokenUsage,
  logApiUsage,
  logIpRequest,
  updateIpRequestCount
} = require('../middleware/auth');

// Yüklenen modelleri saklamak için obje
let models = {};

// NSFW modelini yükle
async function loadModel(modelType = "MobileNetV2") {
  // Model türünü kontrol et
  if (!["MobileNetV2", "MobileNetV2Mid", "InceptionV3"].includes(modelType)) {
    modelType = "MobileNetV2"; // Varsayılan model
  }
  
  // Eğer bu model daha önce yüklenmemişse yükle
  if (!models[modelType]) {
    console.log(`${modelType} modeli yükleniyor...`);
    models[modelType] = await nsfw.load(modelType);
    console.log(`${modelType} modeli başarıyla yüklendi`);
  }
  
  return models[modelType];
}

// Görsel analizi (URL'den)
const predictFromUrl = async (req, res) => {
  try {
    // URL'yi al
    const imageUrl = req.query.url;
    const modelType = req.query.model || "MobileNetV2";
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Görsel URL\'si gereklidir (?url=resim_url şeklinde belirtin)' });
    }
    
    // Endpoint adını belirle
    const endpoint = '/predict';
    
    // Token ihtiyacını hesapla
    const tokensNeeded = calculateTokens();
    
    // Kullanıcı bilgilerini al
    const clientIp = req.clientIp;
    
    // Admin isteği veya sınırsız değilse token kontrolü yap
    if (!req.isUnlimited) {
      const tokensRemaining = req.monthlyTokenLimit - req.tokensUsed;
      
      if (tokensNeeded > tokensRemaining) {
        if (req.usingApiKey) {
          await logApiUsage(req.apiKeyId, clientIp, endpoint, 0, false, 
                            `Yetersiz token: ${tokensNeeded} gerekli, ${tokensRemaining} kaldı`);
        } else {
          await logIpRequest(clientIp, endpoint, 0, false, 
                           `Yetersiz token: ${tokensNeeded} gerekli, ${tokensRemaining} kaldı`);
        }
        
        return res.status(403).json({
          error: "Yetersiz token kredisi",
          tokensNeeded,
          tokensRemaining
        });
      }
    }
    
    // IP bazlı istek limiti için sayacı güncelle (Admin değilse ve API key kullanmıyorsa)
    if (!req.usingApiKey && !req.adminRequest) {
      await updateIpRequestCount(req.ipId);
    }
    
    // İstenen modeli yükle
    const model = await loadModel(modelType);
    
    // Resmi indir
    const pic = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
    });

    // Görsel analizi
    const image = await tf.node.decodeImage(pic.data, 3);
    const predictions = await model.classify(image);
    image.dispose();
    
    // Kullanımı güncelle (Admin değilse ve sınırsız değilse)
    if (!req.isUnlimited && !req.adminRequest) {
      if (req.usingApiKey) {
        await updateTokenUsage(req.apiKeyId, tokensNeeded);
      } else {
        await updateIpTokenUsage(req.ipId, tokensNeeded);
      }
    }
    
    // Kullanımı logla
    if (req.adminRequest) {
      await logIpRequest(clientIp, `${endpoint} (admin)`, 0, true);
    } else if (req.usingApiKey) {
      await logApiUsage(req.apiKeyId, clientIp, endpoint, tokensNeeded, true);
    } else {
      await logIpRequest(clientIp, endpoint, tokensNeeded, true);
    }
    
    // Sonuçları döndür
    const result = {
      model: modelType,
      predictions,
      usage_info: {
        tokens_used: req.adminRequest ? 0 : tokensNeeded,
        unlimited: req.isUnlimited,
        using_api_key: req.usingApiKey,
        admin_request: req.adminRequest
      }
    };
    
    if (!req.isUnlimited && !req.adminRequest) {
      result.usage_info.tokens_remaining = req.monthlyTokenLimit - req.tokensUsed - tokensNeeded;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Görsel analiz edilirken hata:', error);
    res.status(500).json({ error: 'Görsel yüklenemedi' });
  }
};

// Görsel analizi (dosya yükleme)
const predictFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Yüklenen görsel bulunamadı' });
    }
    
    const modelType = req.query.model || "MobileNetV2";
    
    // Endpoint adını belirle
    const endpoint = '/predict (file)';
    
    // Token ihtiyacını hesapla
    const tokensNeeded = calculateTokens();
    
    // Kullanıcı bilgilerini al
    const clientIp = req.clientIp;
    
    // Admin isteği veya sınırsız değilse token kontrolü yap
    if (!req.isUnlimited) {
      const tokensRemaining = req.monthlyTokenLimit - req.tokensUsed;
      
      if (tokensNeeded > tokensRemaining) {
        if (req.usingApiKey) {
          await logApiUsage(req.apiKeyId, clientIp, endpoint, 0, false, 
                            `Yetersiz token: ${tokensNeeded} gerekli, ${tokensRemaining} kaldı`);
        } else {
          await logIpRequest(clientIp, endpoint, 0, false, 
                           `Yetersiz token: ${tokensNeeded} gerekli, ${tokensRemaining} kaldı`);
        }
        
        return res.status(403).json({
          error: "Yetersiz token kredisi",
          tokensNeeded,
          tokensRemaining
        });
      }
    }
    
    // IP bazlı istek limiti için sayacı güncelle (Admin değilse ve API key kullanmıyorsa)
    if (!req.usingApiKey && !req.adminRequest) {
      await updateIpRequestCount(req.ipId);
    }
    
    // İstenen modeli yükle
    const model = await loadModel(modelType);
    
    // Görsel analizi
    const image = await tf.node.decodeImage(req.file.buffer, 3);
    const predictions = await model.classify(image);
    image.dispose();
    
    // Kullanımı güncelle (Admin değilse ve sınırsız değilse)
    if (!req.isUnlimited && !req.adminRequest) {
      if (req.usingApiKey) {
        await updateTokenUsage(req.apiKeyId, tokensNeeded);
      } else {
        await updateIpTokenUsage(req.ipId, tokensNeeded);
      }
    }
    
    // Kullanımı logla
    if (req.adminRequest) {
      await logIpRequest(clientIp, `${endpoint} (admin)`, 0, true);
    } else if (req.usingApiKey) {
      await logApiUsage(req.apiKeyId, clientIp, endpoint, tokensNeeded, true);
    } else {
      await logIpRequest(clientIp, endpoint, tokensNeeded, true);
    }
    
    // Sonuçları döndür
    const result = {
      model: modelType,
      predictions,
      usage_info: {
        tokens_used: req.adminRequest ? 0 : tokensNeeded,
        unlimited: req.isUnlimited,
        using_api_key: req.usingApiKey,
        admin_request: req.adminRequest
      }
    };
    
    if (!req.isUnlimited && !req.adminRequest) {
      result.usage_info.tokens_remaining = req.monthlyTokenLimit - req.tokensUsed - tokensNeeded;
    }
    
    res.json(result);
  } catch (error) {
    console.error('Görsel analiz edilirken hata:', error);
    res.status(500).json({ error: 'Görsel yüklenemedi' });
  }
};

// Toplu görsel analizi (URL listesi)
const batchPredict = async (req, res) => {
  try {
    const { urls = [], model: modelType = "MobileNetV2" } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'Boş olmayan bir URL dizisi gerekmektedir' });
    }
    
    // Endpoint adını belirle
    const endpoint = '/batch_predict';
    
    // Token ihtiyacını hesapla (her görsel 1 token)
    const tokensNeeded = urls.length * calculateTokens();
    
    // Kullanıcı bilgilerini al
    const clientIp = req.clientIp;
    
    // Admin isteği veya sınırsız değilse token kontrolü yap
    if (!req.isUnlimited) {
      const tokensRemaining = req.monthlyTokenLimit - req.tokensUsed;
      
      if (tokensNeeded > tokensRemaining) {
        if (req.usingApiKey) {
          await logApiUsage(req.apiKeyId, clientIp, endpoint, 0, false, 
                            `Yetersiz token: ${tokensNeeded} gerekli, ${tokensRemaining} kaldı`);
        } else {
          await logIpRequest(clientIp, endpoint, 0, false, 
                           `Yetersiz token: ${tokensNeeded} gerekli, ${tokensRemaining} kaldı`);
        }
        
        return res.status(403).json({
          error: "Yetersiz token kredisi",
          tokensNeeded,
          tokensRemaining
        });
      }
    }
    
    // IP bazlı istek limiti için sayacı güncelle (Admin değilse ve API key kullanmıyorsa)
    if (!req.usingApiKey && !req.adminRequest) {
      await updateIpRequestCount(req.ipId);
    }
    
    // İstenen modeli yükle
    const model = await loadModel(modelType);
    
    // Her URL için analiz yap
    const results = [];
    
    for (let i = 0; i < urls.length; i++) {
      try {
        const imageUrl = urls[i];
        
        // Resmi indir
        const pic = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
        });
        
        // Görsel analizi
        const image = await tf.node.decodeImage(pic.data, 3);
        const predictions = await model.classify(image);
        image.dispose();
        
        // Sonucu ekle
        results.push({
          url: imageUrl,
          predictions,
          error: null
        });
      } catch (error) {
        results.push({
          url: urls[i],
          predictions: null,
          error: 'Görsel yüklenemedi'
        });
      }
    }
    
    // Kullanımı güncelle (Admin değilse ve sınırsız değilse)
    if (!req.isUnlimited && !req.adminRequest) {
      if (req.usingApiKey) {
        await updateTokenUsage(req.apiKeyId, tokensNeeded);
      } else {
        await updateIpTokenUsage(req.ipId, tokensNeeded);
      }
    }
    
    // Kullanımı logla
    if (req.adminRequest) {
      await logIpRequest(clientIp, `${endpoint} (admin)`, 0, true);
    } else if (req.usingApiKey) {
      await logApiUsage(req.apiKeyId, clientIp, endpoint, tokensNeeded, true);
    } else {
      await logIpRequest(clientIp, endpoint, tokensNeeded, true);
    }
    
    // Sonuçları döndür
    const response = {
      model: modelType,
      results,
      usage_info: {
        tokens_used: req.adminRequest ? 0 : tokensNeeded,
        unlimited: req.isUnlimited,
        using_api_key: req.usingApiKey,
        admin_request: req.adminRequest
      }
    };
    
    if (!req.isUnlimited && !req.adminRequest) {
      response.usage_info.tokens_remaining = req.monthlyTokenLimit - req.tokensUsed - tokensNeeded;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Toplu analiz sırasında hata:', error);
    res.status(500).json({ error: 'İstek işlenemedi' });
  }
};

// Kullanım bilgilerini döndür
const usageInfo = async (req, res) => {
  try {
    const info = {
      is_unlimited: req.isUnlimited,
      tokens_used: req.tokensUsed,
      using_api_key: req.usingApiKey
    };
    
    if (!req.isUnlimited) {
      info.monthly_token_limit = req.monthlyTokenLimit;
      info.tokens_remaining = req.monthlyTokenLimit - req.tokensUsed;
    }
    
    // IP bazlı bilgiler (API key kullanılmıyorsa)
    if (!req.usingApiKey) {
      const clientIp = req.clientIp;
      
      const [rows] = await pool.query('SELECT * FROM ip_rate_limits WHERE ip_address = ?', [clientIp]);
      
      if (rows.length > 0) {
        const ipInfo = rows[0];
        info.request_count = ipInfo.request_count;
        info.rate_limit = {
          max_requests: 15,
          time_window_minutes: 15
        };
      }
    }
    
    res.json(info);
  } catch (error) {
    console.error('Kullanım bilgisi alınırken hata:', error);
    res.status(500).json({ error: 'İşlem sırasında bir hata oluştu' });
  }
};

// Sağlık kontrolü
const healthCheck = (req, res) => {
  res.json({ status: 'healthy' });
};

// Ana sayfa
const homePage = (req, res) => {
  res.render('index', { title: 'NSFW Görsel Analiz API' });
};

module.exports = {
  loadModel,
  predictFromUrl,
  predictFromFile,
  batchPredict,
  usageInfo,
  healthCheck,
  homePage
}; 