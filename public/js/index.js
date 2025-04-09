document.addEventListener('DOMContentLoaded', () => {
    // API durumunu kontrol et
    checkApiStatus();

    // Test butonuna tıklama olayını ekle
    document.getElementById('test-button').addEventListener('click', handleTest);

    hideLoading();   
});

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

// Test işlemini yönet
async function handleTest() {
    const urlInput = document.getElementById('test-url');
    const fileInput = document.getElementById('test-file');
    const modelInput = document.querySelector('input[name="model"]');
    const resultDiv = document.getElementById('result');
    
    // Sonuç alanını temizle ve gizle
    resultDiv.innerHTML = '';
    resultDiv.classList.add('hidden');
    
    // Yükleme göstergesini göster
    showLoading();
    
    try {
        let response;
        
        if (fileInput.files.length > 0) {
            // Dosya yükleme ile analiz
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            
            response = await fetch(`/predict?model=${modelInput.value}`, {
                method: 'POST',
                body: formData
            });
        } else if (urlInput.value) {
            // URL ile analiz
            response = await fetch(`/predict?url=${encodeURIComponent(urlInput.value)}&model=${modelInput.value}`);
        } else {
            throw new Error('Lütfen bir görsel URL\'si girin veya dosya yükleyin');
        }
        
        const data = await response.json();
        
        if (response.ok) {
            displayResults(data);
            // Dosya seçiciyi sıfırla
            if (fileInput.files.length > 0) {
                resetFileInput();
            }
        } else {
            throw new Error(data.error || 'Analiz sırasında bir hata oluştu');
        }
    } catch (error) {
        resultDiv.className = 'mt-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700';
        resultDiv.textContent = error.message;
        resultDiv.classList.remove('hidden');
    } finally {
        // Yükleme göstergesini gizle
        hideLoading();
    }
}

// Dosya seçiciyi sıfırla
function resetFileInput() {
    // Input elementini doğrudan sıfırla
    const fileInput = document.getElementById('test-file');
    fileInput.value = '';
    
    // Alpine.js için custom event gönder
    window.dispatchEvent(new CustomEvent('reset-file-input'));
}

// Sonuçları göster
function displayResults(data) {
    const resultDiv = document.getElementById('result');
    
    // NSFW skorunu hesapla
    let nsfwScore = 0;
    let highestNsfwCategory = "";
    let highestNsfwValue = 0;
    
    data.predictions.forEach(prediction => {
        // NSFW kategorileri: Porn, Sexy, Hentai
        if (["Porn", "Sexy", "Hentai"].includes(prediction.className)) {
            nsfwScore += prediction.probability;
            
            // En yüksek NSFW kategorisini bul
            if (prediction.probability > highestNsfwValue) {
                highestNsfwValue = prediction.probability;
                highestNsfwCategory = prediction.className;
            }
        }
    });
    
    // NSFW skoruna göre içeriğin güvenlik durumunu belirle
    let isSafe = nsfwScore <= 0.1;
    let isLowNsfw = nsfwScore > 0.1 && nsfwScore <= 0.3;
    let isMediumNsfw = nsfwScore > 0.3 && nsfwScore <= 0.7;
    let isHighNsfw = nsfwScore > 0.7;
    
    // Sonuç alanının rengini NSFW skoruna göre belirle
    if (isHighNsfw) {
        // Yüksek NSFW içerik
        resultDiv.className = 'mt-4 p-4 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800';
    } else if (isMediumNsfw) {
        // Orta NSFW içerik
        resultDiv.className = 'mt-4 p-4 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-800';
    } else if (isLowNsfw) {
        // Düşük NSFW içerik
        resultDiv.className = 'mt-4 p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-800';
                } else {
        // Güvenli içerik
        resultDiv.className = 'mt-4 p-4 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-300 dark:border-green-800';
    }
    
    // Başlık ekle
    let title = '';
    if (isHighNsfw) {
        title = '<div class="font-bold text-red-700 dark:text-red-400 text-lg mb-3">Yüksek NSFW İçerik Tespit Edildi</div>';
    } else if (isMediumNsfw) {
        title = '<div class="font-bold text-orange-700 dark:text-orange-400 text-lg mb-3">Orta Düzey NSFW İçerik Tespit Edildi</div>';
    } else if (isLowNsfw) {
        title = '<div class="font-bold text-yellow-700 dark:text-yellow-400 text-lg mb-3">Düşük Düzey NSFW İçerik Tespit Edildi</div>';
    } else {
        title = '<div class="font-bold text-green-700 dark:text-green-400 text-lg mb-3">Güvenli İçerik</div>';
    }
    
    // Sonuç içeriğini oluştur
    let html = title + '<div class="space-y-2">';
    data.predictions.forEach(prediction => {
        const percentage = (prediction.probability * 100).toFixed(2);
        const isNsfw = ["Porn", "Sexy", "Hentai"].includes(prediction.className);
        const textColor = isNsfw ? 'text-red-600 dark:text-red-400 font-bold' : 'font-medium';
        
        html += `
            <div class="flex justify-between items-center">
                <span class="${textColor}">${prediction.className}:</span>
                <span class="${isNsfw ? 'text-red-600 dark:text-red-400 font-bold' : ''}">${percentage}%</span>
            </div>
        `;
    });
    html += '</div>';
    
    // Görsel gösterimi ekle
    html += createImagePreview(isSafe, isLowNsfw, isMediumNsfw, isHighNsfw);
    
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
}

// Görsel önizleme oluştur
function createImagePreview(isSafe, isLowNsfw, isMediumNsfw, isHighNsfw) {
    const fileInput = document.getElementById('test-file');
    const urlInput = document.getElementById('test-url');
    
    let imageSource = '';
    let isFileImage = false;
    
    // Kaynak kontrolü
    if (fileInput.files.length > 0) {
        isFileImage = true;
        imageSource = URL.createObjectURL(fileInput.files[0]);
    } else if (urlInput.value) {
        imageSource = urlInput.value;
    } else {
        return '';
    }
    
    // Sansür seviyesini belirle
    let blurAmount = 0;
    let warningText = '';
    let containerClass = '';
    
    if (isHighNsfw) {
        blurAmount = 30; // Yüksek bulanıklık
        warningText = '<div class="absolute inset-0 flex items-center justify-center" onclick="window.toggleImageBlur(this.parentNode.querySelector(\'img\'))"><span class="bg-red-600 dark:bg-red-700 text-white px-4 py-2 rounded-md font-bold shadow-lg cursor-pointer">Yüksek NSFW İçerik - Görmek için tıklayın</span></div>';
        containerClass = 'border-4 border-red-500 dark:border-red-700';
    } else if (isMediumNsfw) {
        blurAmount = 20; // Orta bulanıklık
        warningText = '<div class="absolute inset-0 flex items-center justify-center" onclick="window.toggleImageBlur(this.parentNode.querySelector(\'img\'))"><span class="bg-orange-600 dark:bg-orange-700 text-white px-4 py-2 rounded-md font-bold shadow-lg cursor-pointer">Orta Düzey NSFW İçerik - Görmek için tıklayın</span></div>';
        containerClass = 'border-4 border-orange-500 dark:border-orange-700';
    } else if (isLowNsfw) {
        blurAmount = 10; // Düşük bulanıklık
        warningText = '<div class="absolute inset-0 flex items-center justify-center" onclick="window.toggleImageBlur(this.parentNode.querySelector(\'img\'))"><span class="bg-yellow-600 dark:bg-yellow-700 text-white px-4 py-2 rounded-md font-bold shadow-lg cursor-pointer">Düşük Düzey NSFW İçerik - Görmek için tıklayın</span></div>';
        containerClass = 'border-4 border-yellow-500 dark:border-yellow-700';
    }
    
    // Görsel HTML'ini oluştur
    let html = `
        <div class="mt-6">
            <h3 class="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">Yüklenen Görsel:</h3>
            <div class="relative max-w-md mx-auto ${containerClass} rounded-lg overflow-hidden" 
                 data-is-nsfw="${!isSafe}" 
                 data-blur-amount="${blurAmount}">
                <img src="${imageSource}" 
                     alt="Yüklenen görsel" 
                     class="w-full h-auto max-h-96 object-contain ${!isSafe ? 'blur-img' : ''}" 
                     style="${!isSafe ? `filter: blur(${blurAmount}px)` : ''}"
                     onclick="window.toggleImageBlur(this)" />
                ${!isSafe ? warningText : ''}
            </div>
            ${isFileImage ? '<div class="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">Not: Yüklenen dosya tarayıcınızda görüntülenmektedir, sunucuya kaydedilmemiştir.</div>' : ''}
        </div>
    `;
    
    return html;
}

// Görsel bulanıklığını aç/kapat
function toggleImageBlur(imgElement) {
    const container = imgElement.parentNode;
    const isNsfw = container.getAttribute('data-is-nsfw') === 'true';
    
    if (isNsfw) {
        const currentBlur = imgElement.style.filter;
        if (currentBlur && currentBlur !== 'none') {
            // Bulanıklığı kaldır
            imgElement.style.filter = 'none';
            // Uyarı metnini gizle
            const warningText = container.querySelector('div.absolute');
            if (warningText) warningText.style.display = 'none';
        } else {
            // Bulanıklığı geri ekle
            const blurAmount = container.getAttribute('data-blur-amount');
            imgElement.style.filter = `blur(${blurAmount}px)`;
            // Uyarı metnini göster
            const warningText = container.querySelector('div.absolute');
            if (warningText) warningText.style.display = 'flex';
        }
    }
}

// Global erişim için window nesnesine ekle
window.toggleImageBlur = toggleImageBlur;

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

// Sayfa yüklendiğinde yükleme ekranını gizle
window.addEventListener('load', function () {
    document.getElementById('loading-overlay').style.opacity = '0';
    document.getElementById('page-content').style.display = 'block';

    setTimeout(function () {
        document.getElementById('loading-overlay').style.display = 'none';
    }, 500);
}); 