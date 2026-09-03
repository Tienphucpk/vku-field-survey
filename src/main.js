/**
 * main.js - Module chính của ứng dụng VKU Field Survey
 * =====================================================
 * Kiến trúc: Single Page (không routing)
 * Layout:    Header → Dashboard Stats → Form → Survey List
 *
 * Chức năng:
 *  - Tạo khảo sát mới (lưu vào IndexedDB)
 *  - Hiển thị danh sách khảo sát đã lưu
 *  - Xóa từng khảo sát hoặc xóa tất cả
 *  - Theo dõi trạng thái Online / Offline
 *  - Dashboard thống kê: tổng, đã đồng bộ, chưa đồng bộ
 *  - Hoạt động hoàn toàn Offline (Offline-First)
 */

import './styles.css';
import {
  saveSurvey,
  getAllSurveys,
  deleteSurvey,
  deleteAllSurveys,
  getSurveyStatistics
} from './db.js';

/* ==========================================
   1. HẰNG SỐ & CẤU HÌNH
   ========================================== */

/** Danh sách khu vực khảo sát tại VKU */
const LOCATIONS = [
  'Phòng A101',
  'Phòng A102',
  'Phòng A103',
  'Lab 1',
  'Lab 2',
  'Thư viện',
  'Nhà vệ sinh'
];

/** Danh sách hạng mục kiểm tra */
const FACILITIES = [
  'Máy chiếu',
  'Điều hòa',
  'Bàn ghế',
  'Hệ thống điện',
  'Quạt',
  'Cửa',
  'Thiết bị khác'
];

/** Các mức tình trạng */
const CONDITIONS = [
  { value: 'good', label: 'Tốt', emoji: '🟢' },
  { value: 'broken', label: 'Hỏng', emoji: '🔴' },
  { value: 'maintenance', label: 'Cần bảo trì', emoji: '🟡' }
];

/** Các mức độ ưu tiên */
const PRIORITIES = [
  { value: 'low', label: 'Thấp', emoji: '⬜' },
  { value: 'medium', label: 'Trung bình', emoji: '🟦' },
  { value: 'high', label: 'Cao', emoji: '🟧' },
  { value: 'urgent', label: 'Khẩn cấp', emoji: '🟥' }
];

/* ==========================================
   2. KHỞI TẠO ỨNG DỤNG
   ========================================== */

document.addEventListener('DOMContentLoaded', init);

/**
 * Hàm khởi tạo - chạy một lần khi trang đã tải xong.
 * Render giao diện → Tải dữ liệu → Gắn sự kiện → Đăng ký SW
 */
async function init() {
  renderPage();
  setupFormEvents();
  setupOnlineStatus();
  setupInstallPrompt();
  registerServiceWorker();

  // Tải dữ liệu từ IndexedDB và cập nhật UI
  await refreshData();
}

/* ==========================================
   3. RENDER GIAO DIỆN TRANG
   ========================================== */

/**
 * Render toàn bộ HTML layout của ứng dụng.
 * Gồm: Header, Dashboard Stats, Form khảo sát, Danh sách khảo sát
 */
function renderPage() {
  const app = document.getElementById('app');

  app.innerHTML = `
    <!-- ===== HEADER ===== -->
    <header class="app-header">
      <div class="header-inner">
        <div class="header-left">
          <span class="header-icon">🏫</span>
          <div>
            <div class="header-title">VKU Field Survey</div>
            <div class="header-subtitle">Offline Facility Inspection</div>
          </div>
        </div>
        <div class="header-right">
          <button class="btn-install hidden" id="btn-install">
            📲 Cài đặt
          </button>
          <div class="status-badge online" id="status-badge">
            <span class="status-dot"></span>
            <span class="status-text">🟢 Online</span>
          </div>
        </div>
      </div>
    </header>

    <!-- ===== NỘI DUNG CHÍNH ===== -->
    <main class="main-content">

      <!-- ===== DASHBOARD STATS ===== -->
      <section class="stats-section animate-in">
        <div class="stats-grid">
          <div class="stat-card total">
            <div class="stat-icon">📋</div>
            <div class="stat-value" id="stat-total">0</div>
            <div class="stat-label">Tổng khảo sát</div>
          </div>
          <div class="stat-card synced">
            <div class="stat-icon">✅</div>
            <div class="stat-value" id="stat-synced">0</div>
            <div class="stat-label">Đã đồng bộ</div>
          </div>
          <div class="stat-card draft">
            <div class="stat-icon">📝</div>
            <div class="stat-value" id="stat-draft">0</div>
            <div class="stat-label">Offline Draft</div>
          </div>
        </div>
      </section>

      <!-- ===== FORM KHẢO SÁT ===== -->
      <section class="animate-in delay-1">
        <div class="card">
          <div class="card-header">
            <h2>📝 Tạo khảo sát mới</h2>
          </div>
          <div class="card-body">
            <form id="survey-form" novalidate>

              <!-- Tên người khảo sát -->
              <div class="form-group">
                <label class="form-label" for="inspector">
                  Tên người khảo sát <span class="required">*</span>
                </label>
                <input
                  type="text"
                  class="form-input"
                  id="inspector"
                  placeholder="Nhập họ và tên..."
                  required
                />
              </div>

              <!-- Khu vực -->
              <div class="form-group">
                <label class="form-label" for="location">
                  Khu vực <span class="required">*</span>
                </label>
                <select class="form-select" id="location" required>
                  <option value="" disabled selected>-- Chọn khu vực --</option>
                  ${LOCATIONS.map((loc) => `<option value="${loc}">${loc}</option>`).join('')}
                </select>
              </div>

              <!-- Hạng mục kiểm tra -->
              <div class="form-group">
                <label class="form-label" for="facility">
                  Hạng mục kiểm tra <span class="required">*</span>
                </label>
                <select class="form-select" id="facility" required>
                  <option value="" disabled selected>-- Chọn hạng mục --</option>
                  ${FACILITIES.map((f) => `<option value="${f}">${f}</option>`).join('')}
                </select>
              </div>

              <!-- Tình trạng -->
              <div class="form-group">
                <label class="form-label" for="condition">
                  Tình trạng <span class="required">*</span>
                </label>
                <select class="form-select" id="condition" required>
                  <option value="" disabled selected>-- Chọn tình trạng --</option>
                  ${CONDITIONS.map((c) => `<option value="${c.value}">${c.emoji} ${c.label}</option>`).join('')}
                </select>
              </div>

              <!-- Mức độ ưu tiên -->
              <div class="form-group">
                <label class="form-label" for="priority">
                  Mức độ ưu tiên <span class="required">*</span>
                </label>
                <select class="form-select" id="priority" required>
                  <option value="" disabled selected>-- Chọn mức độ --</option>
                  ${PRIORITIES.map((p) => `<option value="${p.value}">${p.emoji} ${p.label}</option>`).join('')}
                </select>
              </div>

              <!-- Ghi chú -->
              <div class="form-group mb-0">
                <label class="form-label" for="note">Ghi chú</label>
                <textarea
                  class="form-textarea"
                  id="note"
                  placeholder="Mô tả chi tiết tình trạng, vị trí hư hỏng..."
                  rows="3"
                ></textarea>
              </div>

              <!-- Nút lưu -->
              <button type="submit" class="btn btn-primary btn-block mt-4" id="btn-submit">
                💾 Lưu khảo sát Offline
              </button>

            </form>
          </div>
        </div>
      </section>

      <!-- ===== DANH SÁCH KHẢO SÁT ===== -->
      <section class="animate-in delay-2">
        <div class="card">
          <div class="card-header">
            <h2>📋 Danh sách khảo sát</h2>
          </div>

          <!-- Danh sách items -->
          <div id="survey-list">
            <!-- Render bởi JavaScript -->
          </div>

          <!-- Nút xóa tất cả -->
          <div class="clear-all-section hidden" id="clear-all-section">
            <button class="btn btn-danger btn-block btn-sm" id="btn-clear-all">
              🗑️ Xóa tất cả dữ liệu
            </button>
          </div>
        </div>
      </section>

    </main>
  `;
}

/* ==========================================
   4. TẢI & CẬP NHẬT DỮ LIỆU
   ========================================== */

/**
 * Tải lại toàn bộ dữ liệu từ IndexedDB.
 * Cập nhật Dashboard stats và render lại danh sách.
 * Hàm này được gọi sau mỗi thao tác CRUD.
 */
async function refreshData() {
  const listContainer = document.getElementById('survey-list');

  try {
    // Lấy toàn bộ danh sách để render trước
    const surveys = await getAllSurveys();
    renderSurveyList(surveys);

    // Lấy thống kê từ IndexedDB
    const stats = await getSurveyStatistics();
    updateDashboardStats(stats);
  } catch (error) {
    console.error('[App] Lỗi tải dữ liệu:', error);
    showToast('⚠️ Không thể tải IndexedDB: ' + (error.message || 'Lỗi DB'), 'error');

    if (listContainer) {
      listContainer.innerHTML = `
        <div class="survey-list-empty">
          <div class="empty-icon">⚠️</div>
          <h3>Lỗi kết nối cơ sở dữ liệu</h3>
          <p>${error.message || 'Phiên bản DB cũ đang mở. Vui lòng tải lại trang.'}</p>
          <button class="btn btn-primary btn-sm mt-3" onclick="window.location.reload()">
            🔄 Tải lại trang (F5)
          </button>
        </div>
      `;
    }
  }
}

/**
 * Cập nhật 3 thẻ thống kê trên Dashboard.
 * @param {Object} stats - { total, synced, unsynced }
 */
function updateDashboardStats(stats) {
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-synced').textContent = stats.synced;
  document.getElementById('stat-draft').textContent = stats.unsynced;
}

/**
 * Render danh sách khảo sát vào DOM.
 * @param {Array} surveys - Mảng các bản ghi Survey
 */
function renderSurveyList(surveys) {
  const listContainer = document.getElementById('survey-list');
  const clearSection = document.getElementById('clear-all-section');

  // Hiển thị / ẩn nút "Xóa tất cả"
  if (surveys.length > 0) {
    clearSection.classList.remove('hidden');
  } else {
    clearSection.classList.add('hidden');
  }

  // Trường hợp chưa có khảo sát nào
  if (surveys.length === 0) {
    listContainer.innerHTML = `
      <div class="survey-list-empty">
        <div class="empty-icon">📭</div>
        <h3>Chưa có khảo sát nào</h3>
        <p>Hãy tạo khảo sát đầu tiên ở form bên trên!</p>
      </div>
    `;
    return;
  }

  // Render từng survey item
  listContainer.innerHTML = surveys
    .map((survey) => renderSurveyItem(survey))
    .join('');

  // Gắn sự kiện xóa cho từng nút
  listContainer.querySelectorAll('.btn-delete-item').forEach((btn) => {
    btn.addEventListener('click', handleDeleteItem);
  });
}

/**
 * Tạo HTML cho một survey item trong danh sách.
 * @param {Object} survey - Bản ghi Survey từ IndexedDB
 * @returns {string} HTML string
 */
function renderSurveyItem(survey) {
  const condInfo = CONDITIONS.find((c) => c.value === survey.condition) || CONDITIONS[0];
  const prioInfo = PRIORITIES.find((p) => p.value === survey.priority) || PRIORITIES[0];

  // Badge trạng thái đồng bộ
  const syncClass = survey.synced ? 'badge-synced' : 'badge-offline';
  const syncLabel = survey.synced ? '✅ Đã đồng bộ' : '🟡 Lưu Offline';

  return `
    <div class="survey-item priority-${survey.priority}">
      <!-- Khu vực -->
      <div class="survey-item-header">
        <div class="survey-item-area">📍 ${survey.location}</div>
      </div>

      <!-- Hạng mục -->
      <div class="survey-item-inspection">🔧 ${survey.facility}</div>

      <!-- Tình trạng + Mức độ ưu tiên -->
      <div class="survey-item-badges">
        <span class="badge badge-${survey.condition}">
          ${condInfo.emoji} ${condInfo.label}
        </span>
        <span class="badge badge-${survey.priority}">
          ${prioInfo.emoji} ${prioInfo.label}
        </span>
      </div>

      <!-- Người khảo sát + Thời gian -->
      <div class="survey-item-meta">
        <span>👤 ${survey.inspector}</span>
        <span>🕐 ${formatDateTime(survey.createdAt)}</span>
      </div>

      <!-- Ghi chú (nếu có) -->
      ${survey.note ? `<div class="survey-item-meta mt-2"><span>💬 ${survey.note}</span></div>` : ''}

      <!-- Trạng thái sync + Nút xóa -->
      <div class="survey-item-footer">
        <span class="badge ${syncClass}">${syncLabel}</span>
        <button class="btn-delete-item" data-id="${survey.id}" title="Xóa khảo sát này">
          🗑️ Xóa
        </button>
      </div>
    </div>
  `;
}

/* ==========================================
   5. XỬ LÝ SỰ KIỆN FORM
   ========================================== */

/**
 * Gắn sự kiện cho form submit và nút xóa tất cả.
 */
function setupFormEvents() {
  document.getElementById('survey-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-clear-all').addEventListener('click', handleClearAll);
}

/**
 * Xử lý khi người dùng submit form "💾 Lưu khảo sát Offline".
 *
 * Luồng xử lý:
 *   1. Ngăn submit mặc định
 *   2. Thu thập dữ liệu từ form
 *   3. Validate các trường bắt buộc
 *   4. Gọi saveSurvey() → IndexedDB tự thêm clientId, createdAt, synced
 *   5. Reset form
 *   6. Cập nhật lại Dashboard + Danh sách
 *
 * @param {Event} event - Submit event
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  const submitBtn = document.getElementById('btn-submit');

  // Thu thập dữ liệu
  const inspector = document.getElementById('inspector').value.trim();
  const location = document.getElementById('location').value;
  const facility = document.getElementById('facility').value;
  const condition = document.getElementById('condition').value;
  const priority = document.getElementById('priority').value;
  const note = document.getElementById('note').value.trim();

  // ---- VALIDATE dữ liệu bắt buộc ----
  if (!inspector) {
    showToast('Vui lòng nhập tên người khảo sát!', 'error');
    document.getElementById('inspector').focus();
    return;
  }
  if (!location) {
    showToast('Vui lòng chọn khu vực!', 'error');
    document.getElementById('location').focus();
    return;
  }
  if (!facility) {
    showToast('Vui lòng chọn hạng mục kiểm tra!', 'error');
    document.getElementById('facility').focus();
    return;
  }
  if (!condition) {
    showToast('Vui lòng chọn tình trạng!', 'error');
    document.getElementById('condition').focus();
    return;
  }
  if (!priority) {
    showToast('Vui lòng chọn mức độ ưu tiên!', 'error');
    document.getElementById('priority').focus();
    return;
  }

  // Hiệu ứng loading trên nút
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Đang lưu...';

  try {
    // Tạo object Survey (clientId, createdAt, synced được db.js tự thêm)
    const surveyData = {
      inspector,
      location,
      facility,
      condition,
      priority,
      note
    };

    // Lưu vào IndexedDB
    const newId = await saveSurvey(surveyData);

    console.log('[App] Khảo sát đã lưu thành công, ID:', newId);

    // Thông báo thành công
    showToast('✅ Đã lưu khảo sát Offline thành công!', 'success');

    // Reset form
    document.getElementById('survey-form').reset();

    // Cập nhật lại Dashboard stats và danh sách
    await refreshData();
  } catch (error) {
    console.error('[App] Lỗi lưu khảo sát:', error);
    showToast('❌ Có lỗi xảy ra khi lưu! ' + error.message, 'error');
  } finally {
    // Khôi phục nút submit
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💾 Lưu khảo sát Offline';
  }
}

/**
 * Xử lý khi người dùng nhấn nút xóa một khảo sát.
 * Hiển thị modal xác nhận trước khi xóa.
 * @param {Event} event - Click event
 */
function handleDeleteItem(event) {
  const id = parseInt(event.currentTarget.dataset.id);

  showConfirmModal(
    '⚠️',
    'Xóa khảo sát',
    'Bạn có chắc chắn muốn xóa khảo sát này? Hành động này không thể hoàn tác.',
    async () => {
      try {
        await deleteSurvey(id);
        showToast('🗑️ Đã xóa khảo sát!', 'success');
        await refreshData();
      } catch (error) {
        console.error('[App] Lỗi xóa:', error);
        showToast('❌ Lỗi khi xóa khảo sát!', 'error');
      }
    }
  );
}

/**
 * Xử lý khi người dùng nhấn nút "Xóa tất cả dữ liệu".
 * Hiển thị modal xác nhận trước khi xóa toàn bộ.
 */
function handleClearAll() {
  showConfirmModal(
    '🗑️',
    'Xóa tất cả dữ liệu',
    'Toàn bộ khảo sát đã lưu sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?',
    async () => {
      try {
        await deleteAllSurveys();
        showToast('🗑️ Đã xóa tất cả dữ liệu!', 'success');
        await refreshData();
      } catch (error) {
        console.error('[App] Lỗi xóa tất cả:', error);
        showToast('❌ Lỗi khi xóa dữ liệu!', 'error');
      }
    }
  );
}

/* ==========================================
   6. TRẠNG THÁI ONLINE / OFFLINE
   ========================================== */

/**
 * Thiết lập theo dõi trạng thái mạng.
 * Sử dụng navigator.onLine và các event 'online' / 'offline'.
 * Tự động cập nhật UI khi trạng thái thay đổi.
 */
function setupOnlineStatus() {
  // Cập nhật UI ngay khi khởi tạo
  updateOnlineUI();

  // Sự kiện khi có mạng trở lại
  window.addEventListener('online', () => {
    updateOnlineUI();
    showToast('🟢 Đã kết nối mạng!', 'success');
  });

  // Sự kiện khi mất mạng
  window.addEventListener('offline', () => {
    updateOnlineUI();
    showToast('🔴 Mất kết nối! Ứng dụng vẫn hoạt động Offline.', 'info');
  });
}

/**
 * Cập nhật giao diện badge trạng thái mạng trên Header.
 * Đọc navigator.onLine để xác định trạng thái hiện tại.
 */
function updateOnlineUI() {
  const badge = document.getElementById('status-badge');
  const isOnline = navigator.onLine;

  if (isOnline) {
    badge.className = 'status-badge online';
    badge.innerHTML = '<span class="status-dot"></span><span class="status-text">🟢 Online</span>';
  } else {
    badge.className = 'status-badge offline';
    badge.innerHTML = '<span class="status-dot"></span><span class="status-text">🔴 Offline</span>';
  }
}

/* ==========================================
   7. TOAST NOTIFICATIONS
   ========================================== */

/**
 * Hiển thị thông báo toast (popup nhỏ trên đầu màn hình).
 * Tự động ẩn sau 3 giây.
 *
 * @param {string} message - Nội dung thông báo
 * @param {'success'|'error'|'info'} type - Loại thông báo (ảnh hưởng màu sắc)
 */
function showToast(message, type = 'success') {
  // Xóa toast cũ nếu đang hiển thị
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  // Tạo phần tử toast mới
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Kích hoạt animation hiện
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Tự ẩn sau 3 giây
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

/* ==========================================
   8. CONFIRM MODAL
   ========================================== */

/**
 * Hiển thị modal xác nhận trước khi thực hiện hành động nguy hiểm.
 *
 * @param {string} icon     - Emoji biểu tượng
 * @param {string} title    - Tiêu đề modal
 * @param {string} message  - Nội dung cảnh báo
 * @param {Function} onConfirm - Hàm callback khi người dùng xác nhận
 */
function showConfirmModal(icon, title, message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Hủy bỏ</button>
        <button class="btn btn-danger" id="modal-confirm">Xác nhận xóa</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Đóng khi click vùng ngoài modal
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Nút Hủy
  document.getElementById('modal-cancel').addEventListener('click', () => {
    overlay.remove();
  });

  // Nút Xác nhận → chạy callback → đóng modal
  document.getElementById('modal-confirm').addEventListener('click', async () => {
    overlay.remove();
    await onConfirm();
  });
}

/* ==========================================
   9. TIỆN ÍCH
   ========================================== */

/**
 * Định dạng chuỗi ISO datetime thành dạng dd/mm/yyyy HH:mm
 * @param {string} isoStr - Chuỗi ISO 8601 (VD: "2026-09-03T17:45:00.000Z")
 * @returns {string} Chuỗi đã format (VD: "03/09/2026 17:45")
 */
function formatDateTime(isoStr) {
  if (!isoStr) return 'N/A';

  const date = new Date(isoStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/* ==========================================
   10. SERVICE WORKER
   ========================================== */

/**
 * Đăng ký Service Worker cho PWA.
 * Cho phép ứng dụng cache tài nguyên và hoạt động Offline.
 */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    // Nếu chạy dev server localhost, tự động unregister Service Worker cũ để nhận HMR ngay lập tức
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
          console.log('[Dev Mode] Đã hủy đăng ký Service Worker cũ để nhận Live Reload');
        }
      });
      return;
    }

    // Chạy trên môi trường Production / Preview: Đăng ký PWA Service Worker bình thường
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA Mode] Service Worker đã đăng ký:', registration.scope);
        registration.update();
      } catch (error) {
        console.error('[App] Lỗi đăng ký Service Worker:', error);
      }
    });
  }
}

/* ==========================================
   11. INSTALLABLE PWA (beforeinstallprompt)
   ========================================== */

let deferredInstallPrompt = null;

/**
 * Xử lý sự kiện beforeinstallprompt để hiển thị nút cài đặt PWA
 */
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Ngăn banner cài đặt mặc định của trình duyệt
    event.preventDefault();
    deferredInstallPrompt = event;

    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
      btnInstall.classList.remove('hidden');

      btnInstall.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        // Hiển thị prompt cài đặt
        deferredInstallPrompt.prompt();

        // Chờ phản hồi của người dùng
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          showToast('📲 Đã cài đặt ứng dụng thành công!', 'success');
        }

        deferredInstallPrompt = null;
        btnInstall.classList.add('hidden');
      });
    }
  });

  // Sự kiện khi PWA đã được cài đặt thành công
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
      btnInstall.classList.add('hidden');
    }
    showToast('🎉 Ứng dụng VKU Field Survey đã được cài đặt!', 'success');
  });
}

