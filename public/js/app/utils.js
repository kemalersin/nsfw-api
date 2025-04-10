// API durumunu kontrol et
async function checkApiStatus() {
    try {
        const response = await fetch('/health');
        const data = await response.json();
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (data.status === 'healthy') {
            statusIndicator.className = 'status-indicator bg-green-500';
            statusText.textContent = 'Çalışıyor';
        } else {
            statusIndicator.className = 'status-indicator bg-red-500';
            statusText.textContent = 'Çalışmıyor';
        }
    } catch (error) {
        console.error('API durumu kontrol edilirken hata:', error);
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        statusIndicator.className = 'status-indicator bg-red-500';
        statusText.textContent = 'API Bağlantı Hatası';
    }
}

// Yükleme göstergesini göster
function showLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
}

// Yükleme göstergesini gizle
function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
        loadingOverlay.style.display = 'none';
    }, 500);
}

// Sayfa yüklendiğinde yükleme göstergesini gizle
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('page-content').style.display = 'block';
    hideLoading();   
});