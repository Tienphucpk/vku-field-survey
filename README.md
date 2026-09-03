# VKU Field Survey

Ứng dụng khảo sát cơ sở vật chất tại trường Đại học Việt Hàn (VKU) - Offline-First Progressive Web App (PWA).

## Features

- Offline-First Architecture
- PWA (Progressive Web App)
- Service Worker (Cache-First Strategy)
- IndexedDB Offline Draft Storage
- Installable PWA App
- Real-time Online / Offline Detection

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Mở trình duyệt tại: **http://localhost:3000**

## Production Build

```bash
npm run build
```

Xem trước bản build production:

```bash
npm run preview
```

## Test PWA

Hướng dẫn kiểm tra tính năng PWA & Offline:

1. Chạy production build: `npm run build && npm run preview`
2. Mở Google Chrome và truy cập địa chỉ preview (VD: `http://localhost:4173` hoặc `http://localhost:3000`).
3. Nhấn **F12** để mở **Chrome DevTools**.
4. Chuyển sang tab **Application**:
   - **Manifest**: Kiểm tra các thông tin App Name, Icons (192x192, 512x512), `display: standalone`, `theme_color`.
   - **Service Workers**: Kiểm tra Service Worker `sw.js` đã được đăng ký và ở trạng thái **Activated and is running**.
   - **Cache Storage**: Kiểm tra bộ nhớ cache `vku-field-survey-v1` chứa các tài nguyên như `index.html`, CSS, JS, Manifest, Icons.
5. Chuyển sang tab **Network** (hoặc tab Application -> Service Workers):
   - Tích chọn checkbox **Offline** (hoặc ngắt kết nối mạng máy tính).
6. **Reload** lại trang (Ctrl + R / F5):
   - Ứng dụng vẫn mở thành công từ Cache.
   - Header hiển thị trạng thái `🔴 Offline`.
7. **Thử nghiệm nhập form**:
   - Điền thông tin khảo sát và nhấn **💾 Lưu khảo sát Offline**.
   - Khảo sát mới xuất hiện ngay trong danh sách (lưu trong IndexedDB).
8. **Reload** lại trang một lần nữa:
   - Dữ liệu khảo sát vẫn tồn tại đầy đủ.

---

## Cách cài đặt PWA (Install App)

### Trên Google Chrome (Desktop)
1. Mở trang web ứng dụng.
2. Trên thanh địa chỉ (Address bar), nhấn vào biểu tượng **Install** (hoặc nút **📲 Cài đặt** trên Header).
3. Nhấn **Install** trong hộp thoại xác nhận.
4. Ứng dụng sẽ chạy ở chế độ **Standalone** (cửa sổ độc lập không có thanh URL).

### Trên Android (Chrome Mobile)
1. Mở trang web trên Chrome điện thoại.
2. Nhấn nút **📲 Cài đặt** hoặc menu 3 chấm ở góc phải -> Chọn **Add to Home screen** (Thêm vào màn hình chính) / **Install app**.
3. Khởi chạy biểu tượng **VKU Survey** từ màn hình chính điện thoại như ứng dụng native.
