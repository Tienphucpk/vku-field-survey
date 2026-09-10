/**
 * api.js - API Abstraction Layer cho VKU Field Survey
 * =====================================================
 * Module quản lý kết nối giữa Sync Queue và Server API.
 *
 * Cấu hình:
 *   - Đặt VITE_API_BASE_URL trong file .env
 *   - Ví dụ: VITE_API_BASE_URL=https://api.vku-survey.example.com
 *
 * Nếu VITE_API_BASE_URL chưa được cấu hình:
 *   - API sẽ hoạt động ở chế độ MOCK (mô phỏng)
 *   - Dữ liệu KHÔNG được gửi đến server thật
 *   - Trạng thái SYNCED chỉ là mô phỏng cho mục đích phát triển/demo
 *
 * Khi có server thật:
 *   - Đặt VITE_API_BASE_URL=<url server>
 *   - API sẽ gọi POST đến endpoint thật
 *   - Trạng thái SYNCED chỉ được đánh dấu khi server trả về success
 */

/* ==========================================
   1. CẤU HÌNH API
   ========================================== */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_TIMEOUT_MS = 15000; // 15 giây timeout

/**
 * Kiểm tra API đã được cấu hình server thật chưa.
 * @returns {boolean}
 */
export function isApiConfigured() {
  return API_BASE_URL.trim().length > 0;
}

/**
 * Trả về thông tin trạng thái API hiện tại.
 * @returns {Object}
 */
export function getApiStatus() {
  const configured = isApiConfigured();
  return {
    configured,
    baseUrl: configured ? API_BASE_URL : null,
    mode: configured ? 'PRODUCTION' : 'MOCK',
    description: configured
      ? `API kết nối đến: ${API_BASE_URL}`
      : 'API chưa được triển khai. Sync Queue hiện lưu dữ liệu local và sẵn sàng kết nối API.'
  };
}

/* ==========================================
   2. SUBMIT SURVEY — HÀM CHÍNH
   ========================================== */

/**
 * Gửi dữ liệu khảo sát lên server.
 *
 * Nếu VITE_API_BASE_URL đã cấu hình:
 *   → POST đến server thật
 *   → Trả về response từ server
 *
 * Nếu VITE_API_BASE_URL chưa cấu hình:
 *   → Chạy chế độ MOCK (mô phỏng)
 *   → Dùng để test Sync Queue flow
 *   → Thêm #fail trong ghi chú để test trạng thái FAILED
 *
 * @param {Object} surveyData - Dữ liệu khảo sát từ IndexedDB
 * @returns {Promise<Object>} - { success, serverId, syncedAt, mode }
 * @throws {Error} - Khi API thất bại hoặc timeout
 */
export async function submitSurvey(surveyData) {
  if (isApiConfigured()) {
    return await submitToRealServer(surveyData);
  } else {
    return await submitMock(surveyData);
  }
}

/* ==========================================
   3. GỌI API SERVER THẬT
   ========================================== */

/**
 * POST dữ liệu khảo sát đến server thật.
 * Endpoint: POST {VITE_API_BASE_URL}/api/surveys
 *
 * Request Body (JSON):
 * {
 *   clientId: "uuid",
 *   inspector: "Tên người khảo sát",
 *   location: "Phòng A101",
 *   facility: "Máy chiếu",
 *   condition: "good|broken|maintenance",
 *   priority: "low|medium|high|urgent",
 *   note: "Ghi chú...",
 *   createdAt: "2024-01-01T00:00:00.000Z"
 * }
 *
 * Expected Response (JSON):
 * {
 *   success: true,
 *   id: "server-generated-id",
 *   syncedAt: "2024-01-01T00:00:00.000Z"
 * }
 *
 * @param {Object} surveyData
 * @returns {Promise<Object>}
 */
async function submitToRealServer(surveyData) {
  const endpoint = `${API_BASE_URL}/api/surveys`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    console.log(`[API] POST ${endpoint}`, { clientId: surveyData.clientId });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        clientId: surveyData.clientId,
        inspector: surveyData.inspector,
        location: surveyData.location,
        facility: surveyData.facility,
        condition: surveyData.condition,
        priority: surveyData.priority,
        note: surveyData.note,
        photo: surveyData.photo || null,
        latitude: surveyData.latitude ?? null,
        longitude: surveyData.longitude ?? null,
        gpsAccuracy: surveyData.gpsAccuracy ?? null,
        gpsTimestamp: surveyData.gpsTimestamp || null,
        createdAt: surveyData.createdAt
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    // Kiểm tra HTTP status
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Server HTTP ${response.status}: ${errorText}`);
    }

    // Parse response
    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Server trả về kết quả không thành công');
    }

    console.log(`[API] ✅ Sync thành công:`, { clientId: surveyData.clientId, serverId: result.id });

    return {
      success: true,
      serverId: result.id || result.serverId || 'SRV_' + surveyData.clientId.slice(0, 8),
      syncedAt: result.syncedAt || new Date().toISOString(),
      mode: 'PRODUCTION'
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Phân loại lỗi rõ ràng
    if (error.name === 'AbortError') {
      throw new Error(`API Timeout: Server không phản hồi sau ${API_TIMEOUT_MS / 1000}s (${endpoint})`);
    }

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(`Không thể kết nối server: ${endpoint} — Kiểm tra VITE_API_BASE_URL hoặc kết nối mạng`);
    }

    throw error;
  }
}

/* ==========================================
   4. CHẾ ĐỘ MOCK (MÔ PHỎNG)
   ========================================== */

/**
 * Mô phỏng API Server cho mục đích phát triển và demo.
 *
 * ⚠️ QUAN TRỌNG:
 * Chế độ MOCK chỉ dùng khi VITE_API_BASE_URL chưa được cấu hình.
 * Dữ liệu KHÔNG được gửi đến server thật.
 * Response chứa mode: 'MOCK' để phân biệt.
 *
 * Test FAILED: Thêm #fail hoặc [fail] trong ghi chú.
 *
 * @param {Object} surveyData
 * @returns {Promise<Object>}
 */
async function submitMock(surveyData) {
  return new Promise((resolve, reject) => {
    // Mô phỏng độ trễ mạng 400ms - 800ms
    const delay = 400 + Math.random() * 400;

    setTimeout(() => {
      // Test case: mô phỏng lỗi server
      const isSimulatedFailure =
        surveyData.note &&
        (surveyData.note.toLowerCase().includes('#fail') ||
         surveyData.note.toLowerCase().includes('[fail]'));

      if (isSimulatedFailure) {
        console.warn('[API-MOCK] ❌ Mô phỏng lỗi server cho:', surveyData.clientId);
        reject(new Error('MOCK — Server HTTP 500: Mô phỏng lỗi đồng bộ (#fail). Dữ liệu vẫn an toàn trong IndexedDB.'));
      } else {
        console.log('[API-MOCK] ✅ Mô phỏng sync thành công:', surveyData.clientId);
        resolve({
          success: true,
          serverId: 'MOCK_' + surveyData.clientId.slice(0, 8),
          syncedAt: new Date().toISOString(),
          mode: 'MOCK'
        });
      }
    }, delay);
  });
}
