(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const o of s)if(o.type==="childList")for(const r of o.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&i(r)}).observe(document,{childList:!0,subtree:!0});function n(s){const o={};return s.integrity&&(o.integrity=s.integrity),s.referrerPolicy&&(o.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?o.credentials="include":s.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function i(s){if(s.ep)return;s.ep=!0;const o=n(s);fetch(s.href,o)}})();const E="VKU_Field_Survey_DB_v5",k=1,l="surveys";let u=!1,c=[],v=1,d=null;function w(){if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")try{return crypto.randomUUID()}catch{}return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,e=>{const t=Math.random()*16|0;return(e==="x"?t:t&3|8).toString(16)})}function f(){if(u)return Promise.resolve(null);if(d)try{return d.transaction(l,"readonly"),Promise.resolve(d)}catch{d=null}return new Promise(e=>{if(!window.indexedDB){u=!0,e(null);return}let t=!1;const n=setTimeout(()=>{t||(t=!0,console.warn("[DB] IndexedDB Timeout -> Dùng Memory Storage"),u=!0,e(null))},1e3);try{const i=indexedDB.open(E,k);i.onupgradeneeded=s=>{const o=s.target.result;if(!o.objectStoreNames.contains(l)){const r=o.createObjectStore(l,{keyPath:"id",autoIncrement:!0});r.createIndex("synced","synced",{unique:!1}),r.createIndex("createdAt","createdAt",{unique:!1})}},i.onsuccess=s=>{t||(t=!0,clearTimeout(n),d=s.target.result,d.onversionchange=()=>{d&&(d.close(),d=null)},e(d))},i.onerror=()=>{t||(t=!0,clearTimeout(n),u=!0,e(null))},i.onblocked=()=>{t||(t=!0,clearTimeout(n),u=!0,e(null))}}catch{t||(t=!0,clearTimeout(n),u=!0,e(null))}})}async function T(e){const t={clientId:w(),inspector:e.inspector||"N/A",location:e.location||"Chưa chọn",facility:e.facility||"Chưa chọn",condition:e.condition||"good",priority:e.priority||"medium",note:e.note||"",createdAt:new Date().toISOString(),synced:!1},n=await f();return u||!n?(t.id=v++,c.push(t),Promise.resolve(t.id)):new Promise(i=>{try{const s=n.transaction(l,"readwrite"),o=s.objectStore(l);let r=null;const m=o.add(t);m.onsuccess=()=>{r=m.result},s.oncomplete=()=>{i(r||t.id||Date.now())},m.onerror=()=>{t.id=v++,c.push(t),i(t.id)},s.onerror=()=>{t.id=v++,c.push(t),i(t.id)}}catch{t.id=v++,c.push(t),i(t.id)}})}async function L(){const e=await f(),t=n=>({id:n.id,clientId:n.clientId||w(),inspector:n.inspector||n.inspectorName||"Khảo sát viên",location:n.location||n.area||"Phòng học",facility:n.facility||n.inspectionItem||"Thiết bị",condition:n.condition||"good",priority:n.priority||"medium",note:n.note||n.notes||"",createdAt:n.createdAt||new Date().toISOString(),synced:!!n.synced});if(u||!e){const n=[...c].map(t).sort((i,s)=>new Date(s.createdAt)-new Date(i.createdAt));return Promise.resolve(n)}return new Promise(n=>{try{const i=e.transaction(l,"readonly"),o=i.objectStore(l).getAll();o.onsuccess=()=>{const m=(o.result||[]).concat(c).map(t).sort((p,y)=>new Date(y.createdAt)-new Date(p.createdAt));n(m)},o.onerror=()=>{n([...c].map(t))},i.onerror=()=>{n([...c].map(t))}}catch{n([...c].map(t))}})}async function D(e){c=c.filter(n=>n.id!==e);const t=await f();return u||!t?Promise.resolve():new Promise(n=>{try{const i=t.transaction(l,"readwrite");i.objectStore(l).delete(e),i.oncomplete=()=>n(),i.onerror=()=>n()}catch{n()}})}async function B(){c=[];const e=await f();return u||!e?Promise.resolve():new Promise(t=>{try{const n=e.transaction(l,"readwrite");n.objectStore(l).clear(),n.oncomplete=()=>t(),n.onerror=()=>t()}catch{t()}})}async function $(){const e=await L(),t=e.length,n=e.filter(s=>s.synced).length,i=t-n;return{total:t,synced:n,unsynced:i}}const A=["Phòng A101","Phòng A102","Phòng A103","Lab 1","Lab 2","Thư viện","Nhà vệ sinh"],O=["Máy chiếu","Điều hòa","Bàn ghế","Hệ thống điện","Quạt","Cửa","Thiết bị khác"],I=[{value:"good",label:"Tốt",emoji:"🟢"},{value:"broken",label:"Hỏng",emoji:"🔴"},{value:"maintenance",label:"Cần bảo trì",emoji:"🟡"}],x=[{value:"low",label:"Thấp",emoji:"⬜"},{value:"medium",label:"Trung bình",emoji:"🟦"},{value:"high",label:"Cao",emoji:"🟧"},{value:"urgent",label:"Khẩn cấp",emoji:"🟥"}];document.addEventListener("DOMContentLoaded",C);async function C(){M(),j(),U(),W(),V(),await g()}function M(){const e=document.getElementById("app");e.innerHTML=`
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
                  ${A.map(t=>`<option value="${t}">${t}</option>`).join("")}
                </select>
              </div>

              <!-- Hạng mục kiểm tra -->
              <div class="form-group">
                <label class="form-label" for="facility">
                  Hạng mục kiểm tra <span class="required">*</span>
                </label>
                <select class="form-select" id="facility" required>
                  <option value="" disabled selected>-- Chọn hạng mục --</option>
                  ${O.map(t=>`<option value="${t}">${t}</option>`).join("")}
                </select>
              </div>

              <!-- Tình trạng -->
              <div class="form-group">
                <label class="form-label" for="condition">
                  Tình trạng <span class="required">*</span>
                </label>
                <select class="form-select" id="condition" required>
                  <option value="" disabled selected>-- Chọn tình trạng --</option>
                  ${I.map(t=>`<option value="${t.value}">${t.emoji} ${t.label}</option>`).join("")}
                </select>
              </div>

              <!-- Mức độ ưu tiên -->
              <div class="form-group">
                <label class="form-label" for="priority">
                  Mức độ ưu tiên <span class="required">*</span>
                </label>
                <select class="form-select" id="priority" required>
                  <option value="" disabled selected>-- Chọn mức độ --</option>
                  ${x.map(t=>`<option value="${t.value}">${t.emoji} ${t.label}</option>`).join("")}
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
  `}async function g(){const e=document.getElementById("survey-list");try{const t=await L();H(t);const n=await $();N(n)}catch(t){console.error("[App] Lỗi tải dữ liệu:",t),a("⚠️ Không thể tải IndexedDB: "+(t.message||"Lỗi DB"),"error"),e&&(e.innerHTML=`
        <div class="survey-list-empty">
          <div class="empty-icon">⚠️</div>
          <h3>Lỗi kết nối cơ sở dữ liệu</h3>
          <p>${t.message||"Phiên bản DB cũ đang mở. Vui lòng tải lại trang."}</p>
          <button class="btn btn-primary btn-sm mt-3" onclick="window.location.reload()">
            🔄 Tải lại trang (F5)
          </button>
        </div>
      `)}}function N(e){document.getElementById("stat-total").textContent=e.total,document.getElementById("stat-synced").textContent=e.synced,document.getElementById("stat-draft").textContent=e.unsynced}function H(e){const t=document.getElementById("survey-list"),n=document.getElementById("clear-all-section");if(e.length>0?n.classList.remove("hidden"):n.classList.add("hidden"),e.length===0){t.innerHTML=`
      <div class="survey-list-empty">
        <div class="empty-icon">📭</div>
        <h3>Chưa có khảo sát nào</h3>
        <p>Hãy tạo khảo sát đầu tiên ở form bên trên!</p>
      </div>
    `;return}t.innerHTML=e.map(i=>P(i)).join(""),t.querySelectorAll(".btn-delete-item").forEach(i=>{i.addEventListener("click",F)})}function P(e){const t=I.find(o=>o.value===e.condition)||I[0],n=x.find(o=>o.value===e.priority)||x[0],i=e.synced?"badge-synced":"badge-offline",s=e.synced?"✅ Đã đồng bộ":"🟡 Lưu Offline";return`
    <div class="survey-item priority-${e.priority}">
      <!-- Khu vực -->
      <div class="survey-item-header">
        <div class="survey-item-area">📍 ${e.location}</div>
      </div>

      <!-- Hạng mục -->
      <div class="survey-item-inspection">🔧 ${e.facility}</div>

      <!-- Tình trạng + Mức độ ưu tiên -->
      <div class="survey-item-badges">
        <span class="badge badge-${e.condition}">
          ${t.emoji} ${t.label}
        </span>
        <span class="badge badge-${e.priority}">
          ${n.emoji} ${n.label}
        </span>
      </div>

      <!-- Người khảo sát + Thời gian -->
      <div class="survey-item-meta">
        <span>👤 ${e.inspector}</span>
        <span>🕐 ${R(e.createdAt)}</span>
      </div>

      <!-- Ghi chú (nếu có) -->
      ${e.note?`<div class="survey-item-meta mt-2"><span>💬 ${e.note}</span></div>`:""}

      <!-- Trạng thái sync + Nút xóa -->
      <div class="survey-item-footer">
        <span class="badge ${i}">${s}</span>
        <button class="btn-delete-item" data-id="${e.id}" title="Xóa khảo sát này">
          🗑️ Xóa
        </button>
      </div>
    </div>
  `}function j(){document.getElementById("survey-form").addEventListener("submit",q),document.getElementById("btn-clear-all").addEventListener("click",K)}async function q(e){e.preventDefault();const t=document.getElementById("btn-submit"),n=document.getElementById("inspector").value.trim(),i=document.getElementById("location").value,s=document.getElementById("facility").value,o=document.getElementById("condition").value,r=document.getElementById("priority").value,m=document.getElementById("note").value.trim();if(!n){a("Vui lòng nhập tên người khảo sát!","error"),document.getElementById("inspector").focus();return}if(!i){a("Vui lòng chọn khu vực!","error"),document.getElementById("location").focus();return}if(!s){a("Vui lòng chọn hạng mục kiểm tra!","error"),document.getElementById("facility").focus();return}if(!o){a("Vui lòng chọn tình trạng!","error"),document.getElementById("condition").focus();return}if(!r){a("Vui lòng chọn mức độ ưu tiên!","error"),document.getElementById("priority").focus();return}t.disabled=!0,t.innerHTML='<span class="spinner"></span> Đang lưu...';try{const y=await T({inspector:n,location:i,facility:s,condition:o,priority:r,note:m});console.log("[App] Khảo sát đã lưu thành công, ID:",y),a("✅ Đã lưu khảo sát Offline thành công!","success"),document.getElementById("survey-form").reset(),await g()}catch(p){console.error("[App] Lỗi lưu khảo sát:",p),a("❌ Có lỗi xảy ra khi lưu! "+p.message,"error")}finally{t.disabled=!1,t.innerHTML="💾 Lưu khảo sát Offline"}}function F(e){const t=parseInt(e.currentTarget.dataset.id);S("⚠️","Xóa khảo sát","Bạn có chắc chắn muốn xóa khảo sát này? Hành động này không thể hoàn tác.",async()=>{try{await D(t),a("🗑️ Đã xóa khảo sát!","success"),await g()}catch(n){console.error("[App] Lỗi xóa:",n),a("❌ Lỗi khi xóa khảo sát!","error")}})}function K(){S("🗑️","Xóa tất cả dữ liệu","Toàn bộ khảo sát đã lưu sẽ bị xóa vĩnh viễn. Bạn có chắc chắn?",async()=>{try{await B(),a("🗑️ Đã xóa tất cả dữ liệu!","success"),await g()}catch(e){console.error("[App] Lỗi xóa tất cả:",e),a("❌ Lỗi khi xóa dữ liệu!","error")}})}function U(){b(),window.addEventListener("online",()=>{b(),a("🟢 Đã kết nối mạng!","success")}),window.addEventListener("offline",()=>{b(),a("🔴 Mất kết nối! Ứng dụng vẫn hoạt động Offline.","info")})}function b(){const e=document.getElementById("status-badge");navigator.onLine?(e.className="status-badge online",e.innerHTML='<span class="status-dot"></span><span class="status-text">🟢 Online</span>'):(e.className="status-badge offline",e.innerHTML='<span class="status-dot"></span><span class="status-text">🔴 Offline</span>')}function a(e,t="success"){const n=document.querySelector(".toast");n&&n.remove();const i=document.createElement("div");i.className=`toast toast-${t}`,i.textContent=e,document.body.appendChild(i),requestAnimationFrame(()=>{i.classList.add("show")}),setTimeout(()=>{i.classList.remove("show"),setTimeout(()=>i.remove(),350)},3e3)}function S(e,t,n,i){const s=document.createElement("div");s.className="modal-overlay",s.innerHTML=`
    <div class="modal">
      <div class="modal-icon">${e}</div>
      <h3>${t}</h3>
      <p>${n}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="modal-cancel">Hủy bỏ</button>
        <button class="btn btn-danger" id="modal-confirm">Xác nhận xóa</button>
      </div>
    </div>
  `,document.body.appendChild(s),s.addEventListener("click",o=>{o.target===s&&s.remove()}),document.getElementById("modal-cancel").addEventListener("click",()=>{s.remove()}),document.getElementById("modal-confirm").addEventListener("click",async()=>{s.remove(),await i()})}function R(e){if(!e)return"N/A";const t=new Date(e),n=String(t.getDate()).padStart(2,"0"),i=String(t.getMonth()+1).padStart(2,"0"),s=t.getFullYear(),o=String(t.getHours()).padStart(2,"0"),r=String(t.getMinutes()).padStart(2,"0");return`${n}/${i}/${s} ${o}:${r}`}function V(){if("serviceWorker"in navigator){if(window.location.hostname==="localhost"||window.location.hostname==="127.0.0.1"){navigator.serviceWorker.getRegistrations().then(e=>{for(let t of e)t.unregister(),console.log("[Dev Mode] Đã hủy đăng ký Service Worker cũ để nhận Live Reload")});return}window.addEventListener("load",async()=>{try{const e=await navigator.serviceWorker.register("/sw.js");console.log("[PWA Mode] Service Worker đã đăng ký:",e.scope),e.update()}catch(e){console.error("[App] Lỗi đăng ký Service Worker:",e)}})}}let h=null;function W(){window.addEventListener("beforeinstallprompt",e=>{e.preventDefault(),h=e;const t=document.getElementById("btn-install");t&&(t.classList.remove("hidden"),t.addEventListener("click",async()=>{if(!h)return;h.prompt(),(await h.userChoice).outcome==="accepted"&&a("📲 Đã cài đặt ứng dụng thành công!","success"),h=null,t.classList.add("hidden")}))}),window.addEventListener("appinstalled",()=>{h=null;const e=document.getElementById("btn-install");e&&e.classList.add("hidden"),a("🎉 Ứng dụng VKU Field Survey đã được cài đặt!","success")})}
