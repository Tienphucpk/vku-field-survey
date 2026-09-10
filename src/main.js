/**
 * main.js - Module chính của ứng dụng VKU Field Survey
 * =====================================================
 * Architecture: Single Page App (PWA)
 * Sync Engine:   IndexedDB Sync Queue
 * Status Lifecycle: PENDING -> SYNCING -> SYNCED / FAILED
 * Features:
 *  - Offline-First survey form storage
 *  - IndexedDB Sync Queue status management
 *  - Automatic sync on online detection
 *  - Manual triggers: Sync Now & Retry Failed
 *  - Single-item retry & Error tracking
 *  - Status filtering: ALL, PENDING, SYNCING, SYNCED, FAILED
 */

import './styles.css';
import {
  saveSurvey,
  getAllSurveys,
  deleteSurvey,
  deleteAllSurveys,
  getSurveyStatistics,
  getPendingSurveys,
  getFailedSurveys,
  getUnsyncedSurveys,
  updateSurveySyncStatus
} from './db.js';
import { submitSurvey, getApiStatus } from './services/api.js';
import { takePhotoNative, readPhotoFileAsBase64, resizeBase64Image } from './services/camera.js';
import { getCurrentPosition, formatCoordinates } from './services/geolocation.js';

/* ==========================================
   1. HẰNG SỐ & TRẠNG THÁI TOÀN CỤC
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

/** Trạng thái filter danh sách hiện tại */
let currentFilter = 'ALL'; // 'ALL' | 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED'

/** Cờ kiểm soát tiến trình sync đang chạy */
let isSyncingProcessRunning = false;

/** Set lưu trữ ID của các survey đang được đồng bộ (Mutex/Lock cấp Item) */
const activeSyncingIds = new Set();

/** Cờ kiểm soát double-submit form */
let isSubmittingForm = false;

/** Dữ liệu ảnh Base64 & Tọa độ GPS của Form hiện tại */
let currentPhotoBase64 = null;
let currentGpsData = null;

/* ==========================================
   2. KHỞI TẠO ỨNG DỤNG
   ========================================== */

document.addEventListener('DOMContentLoaded', init);

/**
 * Hàm khởi tạo - chạy một lần khi trang đã tải xong.
 * Render giao diện → Tải dữ liệu → Gắn sự kiện → Đăng ký SW → Startup Auto Sync
 */
async function init() {
  renderPage();
  setupFormEvents();
  setupSyncToolbarEvents();
  setupOnlineStatus();
  setupInstallPrompt();
  registerServiceWorker();

  // Tải dữ liệu từ IndexedDB và cập nhật UI
  await refreshData();

  // STARTUP AUTO SYNC: Khi app khởi động, nếu online thì kiểm tra và sync
  await startupAutoSync();
}

/**
 * Startup Auto Sync - Kiểm tra IndexedDB khi app khởi động.
 * Nếu navigator.onLine === true và có PENDING/FAILED items thì tự động sync.
 */
async function startupAutoSync() {
  if (!navigator.onLine) {
    console.log('[StartupSync] Offline - bỏ qua auto sync khi khởi động');
    return;
  }

  try {
    const unsynced = await getUnsyncedSurveys();
    if (unsynced.length > 0) {
      console.log(`[StartupSync] Phát hiện ${unsynced.length} bản ghi chưa đồng bộ. Bắt đầu auto sync...`);
      showToast(`🔄 Phát hiện ${unsynced.length} bản ghi chưa đồng bộ. Tự động sync...`, 'info');
      // Delay nhỏ để UI render xong trước khi sync
      setTimeout(() => {
        processSyncQueue({ mode: 'all', silent: false });
      }, 800);
    } else {
      console.log('[StartupSync] Không có bản ghi cần đồng bộ.');
    }
  } catch (error) {
    console.error('[StartupSync] Lỗi kiểm tra:', error);
  }
}

/* ==========================================
   3. RENDER GIAO DIỆN TRANG
   ========================================== */

/**
 * Render toàn bộ HTML layout của ứng dụng.
 * Gồm: Header, Dashboard Stats (4 status), Sync Control Toolbar, Form & Survey List
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
            <div class="header-subtitle">Offline PWA &amp; Sync Queue — <span id="api-mode-label">${getApiStatus().mode}</span></div>
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

      <!-- ===== DASHBOARD STATS (4 STATUS CARDS) ===== -->
      <section class="stats-section animate-in">
        <div class="stats-grid grid-4">
          <div class="stat-card total">
            <div class="stat-icon">📋</div>
            <div class="stat-value" id="stat-total">0</div>
            <div class="stat-label">Tổng khảo sát</div>
          </div>
          <div class="stat-card pending">
            <div class="stat-icon">⏳</div>
            <div class="stat-value" id="stat-pending">0</div>
            <div class="stat-label">Đang chờ (PENDING)</div>
          </div>
          <div class="stat-card synced">
            <div class="stat-icon">✅</div>
            <div class="stat-value" id="stat-synced">0</div>
            <div class="stat-label">Đã đồng bộ (SYNCED)</div>
          </div>
          <div class="stat-card failed">
            <div class="stat-icon">❌</div>
            <div class="stat-value" id="stat-failed">0</div>
            <div class="stat-label">Thất bại (FAILED)</div>
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
                <label class="form-label" for="note">
                  Ghi chú (Thêm <code>#fail</code> để test trạng thái FAILED)
                </label>
                <textarea
                  class="form-textarea"
                  id="note"
                  placeholder="Mô tả chi tiết tình trạng... (Nhập '#fail' trong ghi chú nếu muốn mô phỏng đồng bộ lỗi)"
                  rows="3"
                ></textarea>
              </div>

              <!-- Ảnh minh họa (Camera / File Input) -->
              <div class="form-group mt-3">
                <label class="form-label">📸 Ảnh chụp thực địa</label>
                <div class="media-actions">
                  <button type="button" class="btn-secondary" id="btn-take-photo">
                    📷 Chụp ảnh / Chọn ảnh
                  </button>
                  <input type="file" id="file-input-photo" accept="image/*" capture="environment" style="display: none;" />
                </div>
                <div id="photo-preview-container" class="photo-preview-container hidden">
                  <img id="photo-preview-img" class="photo-preview-img" src="" alt="Ảnh chụp thực địa" />
                  <button type="button" class="btn-remove-photo" id="btn-remove-photo" title="Xóa ảnh">✕</button>
                </div>
              </div>

              <!-- Định vị GPS -->
              <div class="form-group mt-3">
                <label class="form-label">📍 Vị trí GPS</label>
                <div>
                  <button type="button" class="btn-secondary" id="btn-get-location">
                    📡 Lấy vị trí GPS
                  </button>
                </div>
                <div id="location-info" class="location-info-badge hidden">
                  <span>📍 <strong id="location-coords">--</strong> (<span id="location-accuracy">--</span>)</span>
                  <button type="button" class="btn-remove-photo" id="btn-remove-location" style="position:static; width:20px; height:20px; font-size:0.65rem;" title="Xóa tọa độ">✕</button>
                </div>
              </div>

              <!-- Nút lưu -->
              <button type="submit" class="btn btn-primary btn-block mt-4" id="btn-submit">
                💾 Lưu khảo sát vào Sync Queue (PENDING)
              </button>

            </form>
          </div>
        </div>
      </section>

      <!-- ===== DANH SÁCH KHẢO SÁT & SYNC CONTROLLER ===== -->
      <section class="animate-in delay-2">
        <div class="card">
          <div class="card-header">
            <h2>📋 Quản lý Đồng bộ Sync Queue</h2>
          </div>

          <!-- SYNC TOOLBAR & ACTIONS -->
          <div class="sync-toolbar-card">
            <div class="sync-toolbar">
              <div class="sync-actions">
                <button class="btn btn-primary btn-sm" id="btn-sync-now">
                  🔄 Sync Now (Đồng bộ ngay)
                </button>
                <button class="btn btn-danger-outline btn-sm" id="btn-retry-failed">
                  ⚠️ Retry Failed (Thử lại bản ghi lỗi)
                </button>
              </div>

              <!-- FILTER TABS -->
              <div class="filter-tabs mt-3" id="filter-tabs">
                <button class="filter-tab active" data-filter="ALL">Tất cả</button>
                <button class="filter-tab" data-filter="PENDING">⏳ PENDING</button>
                <button class="filter-tab" data-filter="SYNCING">🌀 SYNCING</button>
                <button class="filter-tab" data-filter="SYNCED">✅ SYNCED</button>
                <button class="filter-tab" data-filter="FAILED">❌ FAILED</button>
              </div>
            </div>
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
   4. SERVER SYNC API
   ========================================== */

// API logic đã được tách ra module: src/services/api.js
// - Nếu VITE_API_BASE_URL được cấu hình → gọi server thật
// - Nếu chưa cấu hình → chế độ MOCK (mô phỏng)
// Import: submitSurvey() từ ./services/api.js

/* ==========================================
   5. TIẾN TRÌNH ĐỒNG BỘ (SYNC QUEUE ENGINE)
   ========================================== */

/**
 * Xử lý tiến trình đồng bộ dữ liệu từ IndexedDB lên Server.
 * Cập nhật trạng thái từng bản ghi: PENDING -> SYNCING -> SYNCED / FAILED.
 *
 * @param {Object} options
 * @param {'all'|'failed'|'auto'} options.mode - 'all': sync toàn bộ unsynced; 'failed': chỉ sync các item FAILED; 'auto': khi có internet
 * @param {boolean} options.silent - Nếu true thì không hiển thị toast rườm rà
 */
async function processSyncQueue(options = {}) {
  const { mode = 'all', silent = false } = options;

  if (!navigator.onLine) {
    if (!silent) {
      showToast('🔴 Không có kết nối mạng! Vui lòng kết nối internet để đồng bộ.', 'error');
    }
    return;
  }

  if (isSyncingProcessRunning) {
    if (!silent) {
      showToast('⏳ Tiến trình đồng bộ đang chạy, vui lòng chờ...', 'info');
    }
    return;
  }

  isSyncingProcessRunning = true;
  updateSyncButtonsState(true);

  try {
    let targets = [];
    if (mode === 'failed') {
      targets = await getFailedSurveys();
    } else {
      targets = await getUnsyncedSurveys(); // Lấy PENDING + FAILED
    }

    if (targets.length === 0) {
      if (!silent) {
        showToast('ℹ️ Không có khảo sát nào cần đồng bộ.', 'info');
      }
      return;
    }

    if (!silent) {
      showToast(`🔄 Bắt đầu đồng bộ ${targets.length} bản ghi...`, 'info');
    }

    let successCount = 0;
    let failCount = 0;

    for (const rawItem of targets) {
      // Kiểm tra mạng trước khi xử lý từng item: nếu đứt mạng giữa chừng -> dừng tiến trình an toàn
      if (!navigator.onLine) {
        console.warn('[SyncEngine] Mạng bị ngắt giữa chừng. Dừng tiến trình sync.');
        if (!silent) {
          showToast('🔴 Kết nối mạng bị ngắt. Tiến trình đồng bộ tạm dừng, dữ liệu an toàn ở local.', 'info');
        }
        break;
      }

      // Chống duplicate: kiểm tra nếu item đang được sync ở nơi khác
      if (activeSyncingIds.has(rawItem.id)) {
        console.warn(`[SyncEngine] Skip item ${rawItem.id} - đang trong tiến trình đồng bộ khác.`);
        continue;
      }

      // Đánh dấu lock item
      activeSyncingIds.add(rawItem.id);

      try {
        // Kiểm tra lại trạng thái thực tế từ IndexedDB trước khi gửi API
        const item = await getSurveyById(rawItem.id);
        if (!item || item.syncStatus === 'SYNCED') {
          console.log(`[SyncEngine] Skip item ${rawItem.id} - đã SYNCED hoặc không tồn tại.`);
          continue;
        }

        // Step A: Đánh dấu SYNCING
        await updateSurveySyncStatus(item.id, 'SYNCING');
        await refreshData(); // Refresh UI để item sáng badge xanh SYNCING ngay lập tức

        // Step B: Gọi API (server thật hoặc mock tùy cấu hình VITE_API_BASE_URL)
        await submitSurvey(item);

        // Step C: Thành công -> Chuyển SYNCED
        await updateSurveySyncStatus(item.id, 'SYNCED');
        successCount++;
      } catch (err) {
        // Step D: Thất bại -> Chuyển FAILED + lưu error message + tăng retryCount
        await updateSurveySyncStatus(rawItem.id, 'FAILED', err.message);
        failCount++;

        // Nếu nguyên nhân thất bại do đứt mạng giữa chừng, dừng vòng lặp ngay
        if (!navigator.onLine) {
          console.warn('[SyncEngine] Mạng mất khi đang gửi API. Tạm dừng sync.');
          if (!silent) {
            showToast('🔴 Mất mạng khi đang đồng bộ. Dữ liệu được giữ an toàn ở local!', 'error');
          }
          break;
        }
      } finally {
        activeSyncingIds.delete(rawItem.id);
        await refreshData();
      }
    }

    // Thông báo tổng kết
    if (!silent) {
      if (failCount === 0) {
        showToast(`✅ Đã đồng bộ thành công ${successCount} khảo sát!`, 'success');
      } else {
        showToast(`⚠️ Đồng bộ hoàn tất: ${successCount} thành công, ${failCount} thất bại.`, 'info');
      }
    }
  } catch (error) {
    console.error('[SyncEngine] Lỗi tiến trình:', error);
    if (!silent) {
      showToast('❌ Lỗi tiến trình đồng bộ: ' + error.message, 'error');
    }
  } finally {
    isSyncingProcessRunning = false;
    updateSyncButtonsState(false);
    await refreshData();
  }
}

/**
 * Cập nhật trạng thái disabled/loading cho các nút bấm Sync.
 * @param {boolean} syncing
 */
function updateSyncButtonsState(syncing) {
  const btnSyncNow = document.getElementById('btn-sync-now');
  const btnRetryFailed = document.getElementById('btn-retry-failed');

  if (btnSyncNow) {
    btnSyncNow.disabled = syncing || !navigator.onLine;
    btnSyncNow.innerHTML = syncing
      ? '<span class="spinner-sm"></span> Đang đồng bộ...'
      : '🔄 Sync Now (Đồng bộ ngay)';
  }

  if (btnRetryFailed) {
    btnRetryFailed.disabled = syncing || !navigator.onLine;
    btnRetryFailed.innerHTML = syncing
      ? '<span class="spinner-sm"></span> Đang thử lại...'
      : '⚠️ Retry Failed (Thử lại bản ghi lỗi)';
  }
}

/* ==========================================
   6. TẢI & CẬP NHẬT DỮ LIỆU UI
   ========================================== */

/**
 * Tải lại toàn bộ dữ liệu từ IndexedDB.
 * Cập nhật Dashboard stats và render lại danh sách theo filter hiện tại.
 */
async function refreshData() {
  const listContainer = document.getElementById('survey-list');

  try {
    // Lấy toàn bộ danh sách
    const surveys = await getAllSurveys();

    // Lọc danh sách theo status filter
    const filteredSurveys = filterSurveysByStatus(surveys, currentFilter);

    // Render danh sách
    renderSurveyList(filteredSurveys, surveys.length);

    // Lấy và hiển thị thống kê 4 card
    const stats = await getSurveyStatistics();
    updateDashboardStats(stats);

    // Cập nhật trạng thái nút bấm Sync theo online & list
    updateSyncButtonsState(isSyncingProcessRunning);
  } catch (error) {
    console.error('[App] Lỗi tải dữ liệu:', error);
    showToast('⚠️ Không thể tải dữ liệu từ IndexedDB!', 'error');

    if (listContainer) {
      listContainer.innerHTML = `
        <div class="survey-list-empty">
          <div class="empty-icon">⚠️</div>
          <h3>Lỗi kết nối cơ sở dữ liệu</h3>
          <p>${error.message || 'IndexedDB không phản hồi'}</p>
        </div>
      `;
    }
  }
}

/**
 * Lọc danh sách khảo sát theo tab filter.
 * @param {Array} surveys
 * @param {string} filter
 */
function filterSurveysByStatus(surveys, filter) {
  if (filter === 'ALL') return surveys;
  return surveys.filter((s) => s.syncStatus === filter);
}

/**
 * Cập nhật 4 thẻ thống kê trên Dashboard.
 * @param {Object} stats - { total, synced, pending, syncing, failed }
 */
function updateDashboardStats(stats) {
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-pending').textContent = stats.pending;
  document.getElementById('stat-synced').textContent = stats.synced;
  document.getElementById('stat-failed').textContent = stats.failed;
}

/**
 * Render danh sách khảo sát vào DOM.
 * @param {Array} filteredSurveys - Danh sách đã lọc
 * @param {number} totalCount - Tổng số bản ghi thực tế
 */
function renderSurveyList(filteredSurveys, totalCount) {
  const listContainer = document.getElementById('survey-list');
  const clearSection = document.getElementById('clear-all-section');

  // Hiển thị / ẩn nút "Xóa tất cả"
  if (totalCount > 0) {
    clearSection.classList.remove('hidden');
  } else {
    clearSection.classList.add('hidden');
  }

  // Trường hợp chưa có khảo sát nào
  if (filteredSurveys.length === 0) {
    listContainer.innerHTML = `
      <div class="survey-list-empty">
        <div class="empty-icon">${totalCount === 0 ? '📭' : '🔍'}</div>
        <h3>${totalCount === 0 ? 'Chưa có khảo sát nào' : 'Không có khảo sát thuộc trạng thái này'}</h3>
        <p>${totalCount === 0 ? 'Hãy tạo khảo sát đầu tiên ở form bên trên!' : 'Thử chuyển sang tab filter khác'}</p>
      </div>
    `;
    return;
  }

  // Render từng survey item
  listContainer.innerHTML = filteredSurveys
    .map((survey) => renderSurveyItem(survey))
    .join('');

  // Gắn sự kiện cho từng nút trong item
  listContainer.querySelectorAll('.btn-delete-item').forEach((btn) => {
    btn.addEventListener('click', handleDeleteItem);
  });

  listContainer.querySelectorAll('.btn-retry-single').forEach((btn) => {
    btn.addEventListener('click', handleRetrySingleItem);
  });
}

/**
 * Tạo HTML cho một survey item trong danh sách với Badge & thông tin lỗi chi tiết.
 * @param {Object} survey
 * @returns {string} HTML string
 */
function renderSurveyItem(survey) {
  const condInfo = CONDITIONS.find((c) => c.value === survey.condition) || CONDITIONS[0];
  const prioInfo = PRIORITIES.find((p) => p.value === survey.priority) || PRIORITIES[0];

  // Badge trạng thái đồng bộ
  let syncBadgeHTML = '';
  switch (survey.syncStatus) {
    case 'SYNCED':
      syncBadgeHTML = `<span class="badge badge-synced" title="Đồng bộ lúc: ${formatDateTime(survey.syncedAt)}">✅ SYNCED</span>`;
      break;
    case 'SYNCING':
      syncBadgeHTML = `<span class="badge badge-syncing"><span class="spinner-sm"></span> SYNCING...</span>`;
      break;
    case 'FAILED':
      syncBadgeHTML = `<span class="badge badge-failed" title="${survey.lastError || 'Lỗi đồng bộ'}">❌ FAILED (${survey.retryCount} thử)</span>`;
      break;
    case 'PENDING':
    default:
      syncBadgeHTML = `<span class="badge badge-pending">⏳ PENDING</span>`;
      break;
  }

  // Khối hiển thị thông báo lỗi (chỉ với FAILED)
  const errorBoxHTML = survey.syncStatus === 'FAILED' && survey.lastError
    ? `<div class="survey-item-error">⚠️ ${survey.lastError}</div>`
    : '';

  // Nút Retry riêng cho item nếu PENDING hoặc FAILED
  const retryBtnHTML = (survey.syncStatus === 'FAILED' || survey.syncStatus === 'PENDING')
    ? `<button class="btn-delete-item btn-retry-single" data-id="${survey.id}" title="Thử đồng bộ lại item này">🔄 Đồng bộ</button>`
    : '';

  return `
    <div class="survey-item priority-${survey.priority}">
      <!-- Khu vực -->
      <div class="survey-item-header">
        <div class="survey-item-area">📍 ${survey.location}</div>
        <div>${syncBadgeHTML}</div>
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

      <!-- Người khảo sát + Thời gian tạo -->
      <div class="survey-item-meta">
        <span>👤 ${survey.inspector}</span>
        <span>🕐 ${formatDateTime(survey.createdAt)}</span>
        ${survey.syncedAt ? `<span>⚡ Synced: ${formatDateTime(survey.syncedAt)}</span>` : ''}
      </div>

      <!-- Ghi chú (nếu có) -->
      ${survey.note ? `<div class="survey-item-meta mt-2"><span>💬 ${survey.note}</span></div>` : ''}

      <!-- Ảnh minh họa & GPS (nếu có) -->
      ${survey.photo || (survey.latitude != null && survey.longitude != null) ? `
        <div class="survey-item-meta mt-2" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          ${survey.photo ? `<img src="${survey.photo}" class="survey-item-photo-thumb" alt="Ảnh khảo sát" title="Xem ảnh lớn" onclick="window.open('${survey.photo}', '_blank')" />` : ''}
          ${survey.latitude != null && survey.longitude != null ? `
            <span class="survey-item-gps-badge" title="Chính xác +/-${survey.gpsAccuracy || 0}m">
              📡 GPS: ${formatCoordinates(survey.latitude, survey.longitude)}
            </span>
          ` : ''}
        </div>
      ` : ''}

      <!-- Thông tin lỗi (nếu có) -->
      ${errorBoxHTML}

      <!-- Footer: nút retry & nút xóa -->
      <div class="survey-item-footer">
        <div>
          ${retryBtnHTML}
        </div>
        <button class="btn-delete-item" data-id="${survey.id}" title="Xóa khảo sát này">
          🗑️ Xóa
        </button>
      </div>
    </div>
  `;
}

/* ==========================================
   7. XỬ LÝ SỰ KIỆN FORM & TOOLBAR
   ========================================== */

/**
 * Gắn sự kiện cho Form và Clear All.
 */
function setupFormEvents() {
  document.getElementById('survey-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-clear-all').addEventListener('click', handleClearAll);

  // Camera events
  const btnTakePhoto = document.getElementById('btn-take-photo');
  const fileInputPhoto = document.getElementById('file-input-photo');
  const btnRemovePhoto = document.getElementById('btn-remove-photo');

  if (btnTakePhoto) {
    btnTakePhoto.addEventListener('click', async () => {
      try {
        let base64 = await takePhotoNative();
        if (!base64) {
          // Native cancelled or on Browser -> Fallback trigger file input
          fileInputPhoto.click();
          return;
        }
        base64 = await resizeBase64Image(base64, 1024);
        setPhotoPreview(base64);
      } catch (err) {
        console.warn('[App] Native camera error, falling back to file input:', err);
        fileInputPhoto.click();
      }
    });
  }

  if (fileInputPhoto) {
    fileInputPhoto.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          let base64 = await readPhotoFileAsBase64(file);
          if (base64) {
            base64 = await resizeBase64Image(base64, 1024);
            setPhotoPreview(base64);
          }
        } catch (err) {
          showToast('❌ Không thể đọc file ảnh: ' + err.message, 'error');
        }
      }
    });
  }

  if (btnRemovePhoto) {
    btnRemovePhoto.addEventListener('click', () => {
      clearPhotoPreview();
    });
  }

  // Geolocation events
  const btnGetLocation = document.getElementById('btn-get-location');
  const btnRemoveLocation = document.getElementById('btn-remove-location');

  if (btnGetLocation) {
    btnGetLocation.addEventListener('click', async () => {
      const originalText = btnGetLocation.innerHTML;
      btnGetLocation.disabled = true;
      btnGetLocation.innerHTML = '<span class="spinner-sm"></span> Đang định vị...';

      try {
        const pos = await getCurrentPosition();
        currentGpsData = pos;
        setLocationUI(pos);
        showToast('📍 Đã định vị thành công!', 'success');
      } catch (err) {
        showToast('⚠️ ' + err.message, 'error');
      } finally {
        btnGetLocation.disabled = false;
        btnGetLocation.innerHTML = originalText;
      }
    });
  }

  if (btnRemoveLocation) {
    btnRemoveLocation.addEventListener('click', () => {
      clearLocationUI();
    });
  }
}

function setPhotoPreview(base64) {
  currentPhotoBase64 = base64;
  const container = document.getElementById('photo-preview-container');
  const img = document.getElementById('photo-preview-img');
  if (container && img) {
    img.src = base64;
    container.classList.remove('hidden');
  }
}

function clearPhotoPreview() {
  currentPhotoBase64 = null;
  const container = document.getElementById('photo-preview-container');
  const img = document.getElementById('photo-preview-img');
  const fileInput = document.getElementById('file-input-photo');
  if (container) container.classList.add('hidden');
  if (img) img.src = '';
  if (fileInput) fileInput.value = '';
}

function setLocationUI(pos) {
  const container = document.getElementById('location-info');
  const coordsSpan = document.getElementById('location-coords');
  const accSpan = document.getElementById('location-accuracy');
  if (container && coordsSpan && accSpan) {
    coordsSpan.textContent = formatCoordinates(pos.latitude, pos.longitude);
    accSpan.textContent = `±${pos.accuracy}m`;
    container.classList.remove('hidden');
  }
}

function clearLocationUI() {
  currentGpsData = null;
  const container = document.getElementById('location-info');
  if (container) container.classList.add('hidden');
}

/**
 * Gắn sự kiện cho Toolbar Sync & Tabs.
 */
function setupSyncToolbarEvents() {
  document.getElementById('btn-sync-now').addEventListener('click', () => {
    processSyncQueue({ mode: 'all', silent: false });
  });

  document.getElementById('btn-retry-failed').addEventListener('click', () => {
    processSyncQueue({ mode: 'failed', silent: false });
  });

  // Filter tabs click
  const tabsContainer = document.getElementById('filter-tabs');
  if (tabsContainer) {
    tabsContainer.querySelectorAll('.filter-tab').forEach((tab) => {
      tab.addEventListener('click', (e) => {
        tabsContainer.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentFilter = e.currentTarget.dataset.filter;
        refreshData();
      });
    });
  }
}

/**
 * Xử lý Submit Form lưu khảo sát mới.
 * Khảo sát mới lưu với status 'PENDING'.
 */
async function handleFormSubmit(event) {
  event.preventDefault();

  if (isSubmittingForm) {
    console.warn('[Form] Submit request blocked - form submission already in progress.');
    return;
  }

  isSubmittingForm = true;
  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-sm"></span> Đang lưu vào DB...';

  try {
    // Thu thập dữ liệu
    const inspector = document.getElementById('inspector').value.trim();
    const location = document.getElementById('location').value;
    const facility = document.getElementById('facility').value;
    const condition = document.getElementById('condition').value;
    const priority = document.getElementById('priority').value;
    const note = document.getElementById('note').value.trim();

    // Validate
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

    const surveyData = {
      inspector,
      location,
      facility,
      condition,
      priority,
      note,
      photo: currentPhotoBase64,
      latitude: currentGpsData?.latitude ?? null,
      longitude: currentGpsData?.longitude ?? null,
      gpsAccuracy: currentGpsData?.accuracy ?? null,
      gpsTimestamp: currentGpsData?.timestamp ?? null
    };

    // Lưu vào IndexedDB (Mặc định status: PENDING)
    const newId = await saveSurvey(surveyData);

    showToast('💾 Đã lưu vào IndexedDB Sync Queue (PENDING)!', 'success');

    // Reset form & media
    document.getElementById('survey-form').reset();
    clearPhotoPreview();
    clearLocationUI();

    // Cập nhật UI
    await refreshData();

    // Nếu đang online, thử tự động đồng bộ ngay
    if (navigator.onLine) {
      processSyncQueue({ mode: 'auto', silent: true });
    } else {
      // Offline: Đăng ký Background Sync để sync khi có mạng
      requestBackgroundSync();
    }
  } catch (error) {
    console.error('[App] Lỗi lưu khảo sát:', error);
    showToast('❌ Có lỗi xảy ra khi lưu: ' + error.message, 'error');
  } finally {
    isSubmittingForm = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = '💾 Lưu khảo sát vào Sync Queue (PENDING)';
  }
}

/**
 * Xử lý thử đồng bộ lại 1 item riêng lẻ.
 */
async function handleRetrySingleItem(event) {
  const id = parseInt(event.currentTarget.dataset.id);
  if (!navigator.onLine) {
    showToast('🔴 Không có kết nối mạng!', 'error');
    return;
  }

  if (activeSyncingIds.has(id)) {
    showToast('⏳ Bản ghi này đang trong quá trình đồng bộ, vui lòng chờ...', 'info');
    return;
  }

  activeSyncingIds.add(id);

  try {
    const item = await getSurveyById(id);
    if (!item) {
      showToast('⚠️ Không tìm thấy bản ghi!', 'error');
      return;
    }

    if (item.syncStatus === 'SYNCED') {
      showToast('ℹ️ Bản ghi đã được đồng bộ trước đó.', 'info');
      return;
    }

    await updateSurveySyncStatus(id, 'SYNCING');
    await refreshData();

    await submitSurvey(item);
    await updateSurveySyncStatus(id, 'SYNCED');
    showToast('✅ Đã đồng bộ bản ghi thành công!', 'success');
  } catch (error) {
    await updateSurveySyncStatus(id, 'FAILED', error.message);
    showToast('❌ Đồng bộ bản ghi thất bại: ' + error.message, 'error');
  } finally {
    activeSyncingIds.delete(id);
    await refreshData();
  }
}

/**
 * Xử lý xóa một khảo sát.
 */
function handleDeleteItem(event) {
  const id = parseInt(event.currentTarget.dataset.id);

  showConfirmModal(
    '⚠️',
    'Xóa khảo sát',
    'Bạn có chắc chắn muốn xóa bản ghi này khỏi IndexedDB?',
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
 * Xử lý xóa tất cả khảo sát.
 */
function handleClearAll() {
  showConfirmModal(
    '🗑️',
    'Xóa tất cả dữ liệu',
    'Toàn bộ khảo sát trong IndexedDB Sync Queue sẽ bị xóa vĩnh viễn!',
    async () => {
      try {
        await deleteAllSurveys();
        showToast('🗑️ Đã xóa sạch dữ liệu IndexedDB!', 'success');
        await refreshData();
      } catch (error) {
        console.error('[App] Lỗi xóa tất cả:', error);
        showToast('❌ Lỗi khi xóa dữ liệu!', 'error');
      }
    }
  );
}

/* ==========================================
   8. TRẠNG THÁI ONLINE / OFFLINE & AUTO SYNC
   ========================================== */

/**
 * Theo dõi trạng thái mạng navigator.onLine và tự động kích hoạt Auto Sync khi Online.
 */
function setupOnlineStatus() {
  updateOnlineUI();

  // Sự kiện khi có mạng trở lại -> TỰ ĐỘNG SYNC (OFFLINE → ONLINE)
  window.addEventListener('online', async () => {
    console.log('[Network] OFFLINE → ONLINE detected');
    updateOnlineUI();

    // Kiểm tra xem có items cần sync không trước khi thông báo
    const unsynced = await getUnsyncedSurveys();
    if (unsynced.length > 0) {
      showToast(`🟢 Online! Tự động đồng bộ ${unsynced.length} bản ghi...`, 'success');
      processSyncQueue({ mode: 'all', silent: false });
    } else {
      showToast('🟢 Đã có kết nối mạng!', 'success');
    }
  });

  // Sự kiện khi mất mạng (ONLINE → OFFLINE)
  window.addEventListener('offline', () => {
    console.log('[Network] ONLINE → OFFLINE detected');
    updateOnlineUI();
    showToast('🔴 Mất kết nối mạng! Dữ liệu sẽ lưu offline và tự đồng bộ khi có mạng.', 'info');
  });
}

/* ==========================================
   8b. BACKGROUND SYNC API (OPTIONAL)
   ========================================== */

/**
 * Đăng ký Background Sync với Service Worker.
 * Nếu browser không hỗ trợ Background Sync API, bỏ qua im lặng.
 * Fallback chính là window 'online' event ở trên.
 */
async function requestBackgroundSync() {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    console.log('[BackgroundSync] Browser không hỗ trợ Background Sync API - dùng fallback online event');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-surveys');
    console.log('[BackgroundSync] Đã đăng ký sync tag: sync-surveys');
    return true;
  } catch (error) {
    console.warn('[BackgroundSync] Không thể đăng ký:', error.message);
    return false;
  }
}

/**
 * Cập nhật giao diện badge trạng thái mạng trên Header.
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

  updateSyncButtonsState(isSyncingProcessRunning);
}

/* ==========================================
   9. TOAST NOTIFICATIONS
   ========================================== */

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 350);
  }, 3200);
}

/* ==========================================
   10. CONFIRM MODAL
   ========================================== */

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

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  document.getElementById('modal-cancel').addEventListener('click', () => {
    overlay.remove();
  });

  document.getElementById('modal-confirm').addEventListener('click', async () => {
    overlay.remove();
    await onConfirm();
  });
}

/* ==========================================
   11. TIỆN ÍCH FORMAT DATE
   ========================================== */

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
   12. SERVICE WORKER REGISTRATION (PWA)
   ========================================== */

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
          console.log('[Dev Mode] Unregistered old SW for Live Reload');
        }
      });
      return;
    }

    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA Mode] Service Worker registered:', registration.scope);
        registration.update();
      } catch (error) {
        console.error('[App] SW registration error:', error);
      }
    });

    // Lắng nghe message từ Service Worker (Background Sync)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'BACKGROUND_SYNC') {
        console.log('[BackgroundSync] Nhận message từ SW:', event.data.tag);
        showToast('⚡ Background Sync: Tự động đồng bộ dữ liệu...', 'info');
        processSyncQueue({ mode: 'all', silent: false });
      }
    });
  }
}

/* ==========================================
   13. INSTALLABLE PWA PROMPT
   ========================================== */

let deferredInstallPrompt = null;

function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;

    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
      btnInstall.classList.remove('hidden');

      btnInstall.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;

        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          showToast('📲 Đã cài đặt PWA thành công!', 'success');
        }

        deferredInstallPrompt = null;
        btnInstall.classList.add('hidden');
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    const btnInstall = document.getElementById('btn-install');
    if (btnInstall) {
      btnInstall.classList.add('hidden');
    }
    showToast('🎉 Ứng dụng VKU Field Survey đã được cài đặt!', 'success');
  });
}

