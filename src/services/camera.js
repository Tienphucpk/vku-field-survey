/**
 * camera.js - Capacitor & Browser Fallback Camera Service
 * ========================================================
 * Chụp ảnh thông qua Capacitor Camera plugin trên Android/iOS
 * hoặc Fallback qua HTML5 File Input trên Trình duyệt PWA.
 */

/**
 * Chụp ảnh sử dụng Capacitor Camera (cho Native App)
 * @returns {Promise<string|null>} Data URL dạng Base64 hoặc null nếu hủy / không khả dụng
 */
export async function takePhotoNative() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor && Capacitor.isNativePlatform()) {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: CameraSource.Camera
      });

      if (image && image.base64String) {
        return `data:image/${image.format || 'jpeg'};base64,${image.base64String}`;
      }
    }
  } catch (error) {
    console.warn('[Camera] Lỗi hoặc hủy chụp ảnh Native:', error);
    if (error?.message?.includes('cancelled') || error?.message?.includes('canceled')) {
      return null;
    }
  }
  return null;
}

/**
 * Đọc file ảnh từ HTML Input Element thành Base64 Data URL (cho Browser Fallback)
 * @param {File} file 
 * @returns {Promise<string>}
 */
export function readPhotoFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Nén ảnh base64 nếu vượt quá kích thước cho phép
 * @param {string} base64Str 
 * @param {number} maxWidth 
 * @returns {Promise<string>}
 */
export function resizeBase64Image(base64Str, maxWidth = 1024, quality = 0.8) {
  return new Promise((resolve) => {
    if (!base64Str || typeof base64Str !== 'string') {
      resolve(null);
      return;
    }

    const img = new Image();
    img.src = base64Str;

    img.onload = () => {
      // Nếu chiều rộng đã nhỏ hơn maxWidth và dung lượng chuỗi base64 đã nhỏ (< 500KB)
      if (img.width <= maxWidth && base64Str.length < 500000) {
        resolve(base64Str);
        return;
      }

      try {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / Math.max(img.width, 1);
        canvas.width = Math.min(img.width, maxWidth);
        canvas.height = Math.round(img.height * ratio);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      } catch (err) {
        console.warn('[Camera] Lỗi nén ảnh trên canvas, dùng ảnh gốc:', err);
        resolve(base64Str);
      }
    };

    img.onerror = () => resolve(base64Str);
  });
}
