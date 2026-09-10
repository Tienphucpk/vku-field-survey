/**
 * geolocation.js - Geolocation Service (Capacitor + Browser Fallback)
 * ====================================================================
 * Lấy tọa độ GPS (latitude, longitude, accuracy) từ thiết bị.
 * Ưu tiên Capacitor Geolocation trên Native App, fallback sang Navigator Geolocation trên Browser.
 */

/**
 * Lấy vị trí GPS hiện tại của thiết bị
 * @returns {Promise<{latitude: number, longitude: number, accuracy: number, timestamp: string}>}
 */
export async function getCurrentPosition() {
  // 1. Thử dùng Capacitor Geolocation trên Native Platform
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor && Capacitor.isNativePlatform()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 3000
      });

      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy),
        timestamp: new Date(position.timestamp).toISOString()
      };
    }
  } catch (err) {
    console.warn('[Geolocation] Native Geolocation plugin failed, trying Browser API fallback:', err);
  }

  // 2. Browser Geolocation Fallback
  if ('geolocation' in navigator) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
            timestamp: new Date(pos.timestamp).toISOString()
          });
        },
        (error) => {
          let message = 'Không thể lấy vị trí GPS.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Quyền truy cập vị trí bị từ chối.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'Thông tin vị trí không khả dụng.';
          } else if (error.code === error.TIMEOUT) {
            message = 'Quá thời gian chờ định vị GPS.';
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  throw new Error('Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS.');
}

/**
 * Định dạng tọa độ hiển thị đẹp (ví dụ: 15.9753, 108.2532)
 * @param {number} lat 
 * @param {number} lng 
 * @returns {string}
 */
export function formatCoordinates(lat, lng) {
  if (lat == null || lng == null) return '';
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}
