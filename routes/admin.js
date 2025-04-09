const express = require('express');
const router = express.Router();
const { adminRequired } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Admin panel ve oturum yönetimi
router.get('/', adminController.adminPanel);
router.post('/login', adminController.adminLogin);
router.get('/logout', adminController.adminLogout);

// API key yönetimi
router.get('/keys', adminRequired, adminController.listApiKeys);
router.get('/keys/:keyId', adminRequired, adminController.getApiKey);
router.delete('/keys/:keyId', adminRequired, adminController.deleteApiKey);
router.post('/keys', adminRequired, adminController.createApiKey);
router.put('/keys/:keyId', adminRequired, adminController.updateApiKey);

// IP yönetimi
router.get('/list_ip_usage', adminRequired, adminController.listIpUsage);
router.post('/reset_ip_limits/:ipAddress', adminRequired, adminController.resetIpLimits);

// Kullanım istatistikleri
router.get('/usage_summary', adminRequired, adminController.usageSummary);

module.exports = router; 