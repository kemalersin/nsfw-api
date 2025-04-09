const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireApiKey } = require('../middleware/auth');
const nsfwController = require('../controllers/nsfwController');

// Multer ayarları
const upload = multer({ storage: multer.memoryStorage() });

// Ana sayfa ve sağlık kontrolü
router.get('/', nsfwController.homePage);
router.get('/health', nsfwController.healthCheck);

// API endpoint'leri
router.get('/predict', requireApiKey, nsfwController.predictFromUrl);
router.post('/predict', requireApiKey, upload.single('image'), nsfwController.predictFromFile);
router.post('/batch_predict', requireApiKey, nsfwController.batchPredict);
router.get('/usage_info', requireApiKey, nsfwController.usageInfo);

module.exports = router; 