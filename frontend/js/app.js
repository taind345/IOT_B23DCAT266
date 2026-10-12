/* ==========================================================================
   SMART HOME IOT - LOGIC ĐIỀU KHIỂN & GIAO TIẾP API (FRONTEND)
   MỤC LỤC TÌM KIẾM NHANH KHI BỊ THẦY HỎI / BẮT SỬA CODE:
   1. HÀM DÙNG CHUNG (fmtTime, badge, updatePagInfo)
   2. UC1: XÁC THỰC & ĐĂNG NHẬP (checkAuth, handleLogin, handleLogout)
   3. UC6: HỒ SƠ CÁ NHÂN (fetchProfile, handleUpdateProfile)
   4. ĐIỀU HƯỚNG TABS (switchTab)
   5. UC2 & UC3: DASHBOARD & ĐIỀU KHIỂN THIẾT BỊ (toggleDevice, fetchDevices)
   6. BIỂU ĐỒ REALTIME CHART.JS (fetchSensorData, updateChart)
   7. UC4: LỊCH SỬ DỮ LIỆU CẢM BIẾN (fetchDataSensor, sortData, resetSensorFilter)
   8. UC5: LỊCH SỬ BẬT TẮT THIẾT BỊ (fetchActiveHistory, sortHist)
   9. TIỆN ÍCH PHÂN TRANG HIỆN ĐẠI (renderPaginationModern)
   10. KHỞI CHẠY HỆ THỐNG
   ========================================================================== */

/* --------------------------------------------------------------------------
   1. HÀM DÙNG CHUNG (UTILITIES)
   -------------------------------------------------------------------------- */
/**
 * Định dạng ngày giờ thành chuỗi dd/mm/yyyy hh:mm
 * @param {string|Date} d - Chuỗi hoặc đối tượng thời gian
 */
const fmtTime = (d) => {
    const dt = new Date(d);
    const pad = (n) => ('0' + n).slice(-2);
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

/**
 * Sinh chuỗi HTML huy hiệu (Badge) có màu nền tương ứng
 * @param {string} text - Nội dung huy hiệu (ON/OFF/loading...)
 * @param {string} bg - Mã màu HEX
 */
const badge = (text, bg) => `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:0.85rem;">${text}</span>`;

/**
 * Cập nhật dòng chữ hiển thị phân trang (Ví dụ: Hiển thị 1-10 / 40 bản ghi)
 * @param {string} id - ID của phần tử chứa text
 * @param {object} pag - Đối tượng phân trang từ API
 */
const updatePagInfo = (id, pag) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!pag || pag.totalItems <= 0) {
        el.innerText = 'Không có bản ghi nào';
        return;
    }
    const start = (pag.currentPage - 1) * pag.limit + 1;
    const end = Math.min(pag.currentPage * pag.limit, pag.totalItems);
    el.innerText = `Hiển thị ${start}-${end} / ${pag.totalItems} bản ghi`;
};

/* --------------------------------------------------------------------------
   2. UC1: XÁC THỰC & ĐĂNG NHẬP (AUTHENTICATION)
   -------------------------------------------------------------------------- */
let currentAuthToken = localStorage.getItem('token') || '';
let currentUser = null;

/**
 * Kiểm tra trạng thái đăng nhập khi mở trang web
 */
function checkAuth() {
    if (!currentAuthToken) {
        document.getElementById('login-overlay').style.display = 'flex';
    } else {
        document.getElementById('login-overlay').style.display = 'none';
        try {
            const savedUser = JSON.parse(localStorage.getItem('user'));
            if (savedUser) {
                currentUser = savedUser;
                document.getElementById('current-user-badge').innerText = `User: ${savedUser.fullName || savedUser.username} (${savedUser.role})`;
            }
        } catch (e) {}
        fetchProfile();
    }
}

/**
 * Xử lý sự kiện đăng nhập khi bấm submit form
 */
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errBox = document.getElementById('login-error');
    errBox.style.display = 'none';

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Đăng nhập thất bại');
        }

        currentAuthToken = data.token;
        currentUser = data.user;
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('current-user-badge').innerText = `User: ${data.user.fullName || data.user.username} (${data.user.role})`;
        
        switchTab('dashboard');
        fetchSensorData();
    } catch (err) {
        errBox.innerText = err.message;
        errBox.style.display = 'block';
    }
}

/**
 * Xử lý đăng xuất tài khoản
 */
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentAuthToken = '';
    currentUser = null;
    document.getElementById('login-overlay').style.display = 'flex';
}

/* --------------------------------------------------------------------------
   3. UC6: HỒ SƠ CÁ NHÂN & TÀI NGUYÊN (USER PROFILE)
   -------------------------------------------------------------------------- */
/**
 * Lấy thông tin hồ sơ cá nhân của người dùng hiện tại từ Backend
 */
async function fetchProfile() {
    if (!currentAuthToken) return;
    try {
        const res = await fetch('/api/profile', {
            headers: { 'Authorization': `Bearer ${currentAuthToken}` }
        });
        const json = await res.json();
        if (json.success && json.user) {
            const u = json.user;
            document.getElementById('profile-username').value = u.username;
            document.getElementById('profile-role').value = u.role.toUpperCase();
            document.getElementById('profile-fullname').value = u.fullName || '';
            document.getElementById('profile-email').value = u.email || '';
            document.getElementById('current-user-badge').innerText = `User: ${u.fullName || u.username} (${u.role})`;
        } else if (res.status === 401 || res.status === 403) {
            handleLogout();
        }
    } catch (e) {}
}

/**
 * Cập nhật thông tin họ tên, email cá nhân
 */
async function handleUpdateProfile(e) {
    e.preventDefault();
    const fullName = document.getElementById('profile-fullname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const msgBox = document.getElementById('profile-msg');

    try {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentAuthToken}`
            },
            body: JSON.stringify({ fullName, email })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);

        msgBox.innerText = 'Cập nhật hồ sơ thành công!';
        msgBox.style.display = 'block';
        setTimeout(() => msgBox.style.display = 'none', 3000);
        fetchProfile();
    } catch (err) {
        alert('Lỗi cập nhật hồ sơ: ' + err.message);
    }
}

/* --------------------------------------------------------------------------
   4. ĐIỀU HƯỚNG CÁC TRANG TABS (NAVIGATION)
   -------------------------------------------------------------------------- */
/**
 * Chuyển đổi giữa các tab: dashboard, data, history, profile
 * @param {string} tabId - Tên tab
 */
function switchTab(tabId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

    const targetPage = document.getElementById('page-' + tabId);
    const targetNav = document.getElementById('nav-' + tabId);
    if (targetPage) targetPage.classList.add('active');
    if (targetNav) targetNav.classList.add('active');

    // Tự động load dữ liệu tương ứng khi vào từng màn hình
    if (tabId === 'dashboard' && typeof sensorChart !== 'undefined') {
        setTimeout(() => sensorChart.resize(), 50);
    }
    if (tabId === 'data') fetchDataSensor();
    if (tabId === 'history') fetchActiveHistory();
    if (tabId === 'profile') fetchProfile();
}

/* --------------------------------------------------------------------------
   5. UC2 & UC3: DASHBOARD & ĐIỀU KHIỂN THIẾT BỊ (DEVICE CONTROL)
   -------------------------------------------------------------------------- */
/**
 * Gửi lệnh bật/tắt thiết bị (Quạt, Đèn 1, Đèn 2) xuống Backend
 * @param {string} deviceCode - FAN_01, LED_01, LED_02
 * @param {HTMLInputElement} checkboxEl - Thẻ input checkbox tương ứng
 */
async function toggleDevice(deviceCode, checkboxEl) {
    const isChecked = checkboxEl.checked;
    const action = isChecked ? 'ON' : 'OFF';
    try {
        const res = await fetch('/api/v1/devices/toggle', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentAuthToken}`
            },
            body: JSON.stringify({ deviceCode, action })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message);
    } catch (error) {
        alert('Lỗi điều khiển thiết bị: ' + error.message);
        checkboxEl.checked = !isChecked; // Khôi phục trạng thái cũ nếu lỗi
    }
}

/**
 * Tải trạng thái hiện tại của toàn bộ thiết bị khi mở trang
 */
async function fetchDevices() {
    try {
        const res = await fetch('/api/devices');
        const json = await res.json();
        if (json.success && json.data) {
            json.data.forEach(dev => {
                const el = document.getElementById(`dev-${dev.device_code}`);
                if (el) el.checked = (dev.status === 'ON');
            });
        }
    } catch (e) {}
}

/* --------------------------------------------------------------------------
   6. BIỂU ĐỒ THỜI GIAN THỰC (REALTIME SENSOR MONITORING)
   -------------------------------------------------------------------------- */
const ctx = document.getElementById('sensorChart').getContext('2d');
const sensorChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'Nhiệt độ (°C)', borderColor: '#d84315', backgroundColor: '#d84315', data: [], tension: 0.1, borderWidth: 3 },
            { label: 'Độ ẩm (%)', borderColor: '#0277bd', backgroundColor: '#0277bd', data: [], tension: 0.1, borderWidth: 3 },
            { label: 'Độ sáng (lux)', borderColor: '#f57f17', backgroundColor: '#f57f17', data: [], tension: 0.1, borderWidth: 3 }
        ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { labels: { font: { family: "'Courier Prime', monospace" } } } },
        scales: {
            x: { ticks: { font: { family: "'Courier Prime', monospace" } } },
            y: { ticks: { font: { family: "'Courier Prime', monospace" } } }
        }
    }
});

/**
 * Cập nhật các điểm dữ liệu mới vào biểu đồ Chart.js (tối đa 10 điểm gần nhất)
 */
function updateChart(data) {
    const timeLabel = new Date().toLocaleTimeString();
    sensorChart.data.labels.push(timeLabel);
    sensorChart.data.datasets[0].data.push(data.temperature);
    sensorChart.data.datasets[1].data.push(data.humidity);
    sensorChart.data.datasets[2].data.push(data.lightLevel);
    if (sensorChart.data.labels.length > 10) {
        sensorChart.data.labels.shift();
        sensorChart.data.datasets.forEach(d => d.data.shift());
    }
    sensorChart.update();
}

/**
 * Lấy dữ liệu cảm biến mới nhất từ server và cập nhật lên thẻ Dashboard + Biểu đồ
 */
async function fetchSensorData() {
    try {
        const res = await fetch('/api/v1/sensors/data/latest');
        if (!res.ok) return;
        const result = await res.json();
        if (result.success && result.data) {
            const data = result.data;
            document.getElementById('val-temp').innerText = `${data.temperature} °C`;
            document.getElementById('val-humi').innerText = `${data.humidity} %`;
            document.getElementById('val-light').innerText = `${data.lightLevel} lux`;
            updateChart(data);
        }
    } catch (e) {}
}

/* --------------------------------------------------------------------------
   7. UC4: LỊCH SỬ DỮ LIỆU CẢM BIẾN (SENSOR DATA HISTORY)
   -------------------------------------------------------------------------- */
let dataState = { page: 1, limit: 10, sortBy: 'id', sortOrder: 'ASC' };

/**
 * Sắp xếp bảng lịch sử cảm biến theo cột được nhấn
 * @param {string} col - Tên trường: id, sensorName, value, recordedAt
 */
function sortData(col) {
    dataState.sortOrder = (dataState.sortBy === col && dataState.sortOrder === 'ASC') ? 'DESC' : 'ASC';
    dataState.sortBy = col;
    fetchDataSensor(1);
}

/**
 * Xóa bộ lọc tìm kiếm cảm biến về mặc định
 */
function resetSensorFilter() {
    const t = document.getElementById('filter-sensor-type');
    const v = document.getElementById('filter-sensor-value');
    const tm = document.getElementById('filter-sensor-time');
    if (t) t.value = 'all';
    if (v) v.value = '';
    if (tm) tm.value = '';
    fetchDataSensor(1);
}

/**
 * Lấy danh sách lịch sử cảm biến theo bộ lọc, trang và thứ tự sắp xếp
 */
async function fetchDataSensor(page = dataState.page) {
    dataState.page = page;
    const sensorType = document.getElementById('filter-sensor-type')?.value || 'all';
    const keywordValue = document.getElementById('filter-sensor-value')?.value || '';
    const keywordTime = document.getElementById('filter-sensor-time')?.value || '';
    const url = `/api/history/sensors?page=${page}&limit=${dataState.limit}&sensorType=${encodeURIComponent(sensorType)}&keywordValue=${encodeURIComponent(keywordValue)}&keywordTime=${encodeURIComponent(keywordTime)}&sortBy=${dataState.sortBy}&sortOrder=${dataState.sortOrder}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
            const tbody = document.getElementById('table-data');
            if (!json.data || json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 25px; color: #8d6e63;">Không tìm thấy bản ghi cảm biến nào</td></tr>';
            } else {
                tbody.innerHTML = json.data.map(row => {
                    const valColor = row.sensorType === 'humidity' ? '#0277bd' : (row.sensorType === 'light' ? '#e65100' : '#d84315');
                    return `<tr>
                        <td style="color: #9e9e9e; font-family: monospace; font-size: 0.92rem;">${row.displayId || ('#' + String(row.id).padStart(3, '0'))}</td>
                        <td style="font-weight: 500; color: #3e2723;">${row.sensorName}</td>
                        <td style="font-weight: 700; color: ${valColor}; font-size: 0.95rem;">${row.value} ${row.unit}</td>
                        <td style="color: #616161; font-family: monospace;">${fmtTime(row.recordedAt)}</td>
                    </tr>`;
                }).join('');
            }
            updatePagInfo('info-sensor-pag', json.pagination);
            renderPaginationModern('pag-data', json.pagination, fetchDataSensor);
        }
    } catch (e) {
        console.error(e);
    }
}

/* --------------------------------------------------------------------------
   8. UC5: LỊCH SỬ BẬT TẮT THIẾT BỊ (ACTION HISTORY)
   -------------------------------------------------------------------------- */
let histState = { page: 1, limit: 10, sortBy: 'id', sortOrder: 'DESC' };

/**
 * Sắp xếp bảng lịch sử hoạt động thiết bị
 * @param {string} col - Tên trường: deviceId, deviceName, action, status, time, responseTime
 */
function sortHist(col) {
    histState.sortOrder = (histState.sortBy === col && histState.sortOrder === 'ASC') ? 'DESC' : 'ASC';
    histState.sortBy = col;
    fetchActiveHistory(1);
}

/**
 * Lấy danh sách lịch sử bật/tắt thiết bị theo từ khóa tìm kiếm và trang
 */
async function fetchActiveHistory(page = histState.page) {
    histState.page = page;
    const searchBy = document.getElementById('search-hist-col').value;
    const keyword = document.getElementById('search-hist-input').value;
    const url = `/api/history/actions?page=${page}&limit=${histState.limit}&searchBy=${searchBy}&keyword=${encodeURIComponent(keyword)}&sortBy=${histState.sortBy}&sortOrder=${histState.sortOrder}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        const tbody = document.getElementById('table-hist');
        if (json.success) {
            if (!json.data || json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 25px; color: #8d6e63;">Chưa có lịch sử hoạt động nào</td></tr>';
            } else {
                tbody.innerHTML = json.data.map(row => {
                    const actBadge = badge(row.action, row.action === 'ON' ? '#2e7d32' : '#c62828');
                    const statColor = row.status === 'ON' ? '#2e7d32' : (row.status === 'OFF' ? '#c62828' : '#f57f17');
                    const statBadge = badge(row.status || 'loading', statColor);
                    const devId = row.deviceId || row.deviceCode || 'DEV';
                    return `<tr>
                        <td><span class="dev-tag">${devId}</span></td>
                        <td><b>${row.deviceName}</b></td>
                        <td>${actBadge}</td>
                        <td>${statBadge}</td>
                        <td style="font-family: monospace;">${fmtTime(row.time)}</td>
                        <td style="font-family: monospace;">${fmtTime(row.responseTime || row.time)}</td>
                    </tr>`;
                }).join('');
            }
            updatePagInfo('info-hist-pag', json.pagination);
            renderPaginationModern('pag-hist', json.pagination, fetchActiveHistory);
        } else if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 25px; color: #c62828;">${json.message || 'Lỗi tải dữ liệu'}</td></tr>`;
        }
    } catch (e) {
        console.error(e);
    }
}

/* --------------------------------------------------------------------------
   9. TIỆN ÍCH PHÂN TRANG HIỆN ĐẠI (PAGINATION GENERATOR)
   -------------------------------------------------------------------------- */
/**
 * Tạo các nút phân trang chuẩn Figma (Tối đa 5 trang: < 1 2 3 4 5 >)
 * @param {string} containerId - ID của thẻ chứa phân trang
 * @param {object} pagination - Đối tượng phân trang ({ currentPage, totalPages })
 * @param {function} fetchFunc - Hàm callback gọi lại khi bấm chuyển trang
 */
function renderPaginationModern(containerId, pagination, fetchFunc) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!pagination || pagination.totalPages <= 0) return;

    const cur = pagination.currentPage;
    const total = Math.min(pagination.totalPages, 5); // Giới hạn hiển thị tối đa 5 trang

    const addBtn = (label, disabled, active, onClick) => {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (active ? ' active' : '');
        btn.innerHTML = label;
        btn.disabled = disabled;
        if (onClick) btn.onclick = onClick;
        container.appendChild(btn);
    };

    // Nút lùi trang (<)
    addBtn('&lt;', cur <= 1, false, () => fetchFunc(cur - 1));

    // Các nút số trang
    for (let i = 1; i <= total; i++) {
        addBtn(i, false, i === cur, () => fetchFunc(i));
    }

    // Nút tiến trang (>)
    addBtn('&gt;', cur >= total, false, () => fetchFunc(cur + 1));
}

/* --------------------------------------------------------------------------
   10. KHỞI CHẠY HỆ THỐNG KHI TẢI TRANG (BOOTSTRAP)
   -------------------------------------------------------------------------- */
checkAuth();
fetchDevices();
fetchSensorData();
// Tự động cập nhật dữ liệu cảm biến mỗi 3 giây
setInterval(fetchSensorData, 3000);
