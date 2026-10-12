// Biến toàn cục
let currentAuthToken = localStorage.getItem('token') || '';
let currentUser = null;
let dataState = { page: 1, limit: 10, sortBy: 'id', sortOrder: 'ASC' };
let histState = { page: 1, limit: 10, sortBy: 'id', sortOrder: 'DESC' };

// Format thời gian dd/mm/yyyy hh:mm
const fmtTime = d => {
    const dt = new Date(d), pad = n => ('0' + n).slice(-2);
    return `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

// Huy hiệu trạng thái
const badge = (text, bg) => `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-weight:bold;font-size:0.85rem;">${text}</span>`;

// Cập nhật text số bản ghi phân trang
const updatePagInfo = (id, pag) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerText = (!pag || pag.totalItems <= 0) ? 'Không có bản ghi nào' :
        `Hiển thị ${(pag.currentPage - 1) * pag.limit + 1}-${Math.min(pag.currentPage * pag.limit, pag.totalItems)} / ${pag.totalItems} bản ghi`;
};

// Kiểm tra đăng nhập
function checkAuth() {
    const overlay = document.getElementById('login-overlay');
    if (!currentAuthToken) { overlay.style.display = 'flex'; return; }
    overlay.style.display = 'none';
    try {
        const u = JSON.parse(localStorage.getItem('user'));
        if (u) {
            currentUser = u;
            document.getElementById('current-user-badge').innerText = `User: ${u.fullName || u.username} (${u.role})`;
        }
    } catch (e) {}
    fetchProfile();
}

// Xử lý đăng nhập
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
        if (!res.ok || !data.success) throw new Error(data.message || 'Đăng nhập thất bại');

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

// Đăng xuất
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentAuthToken = '';
    currentUser = null;
    document.getElementById('login-overlay').style.display = 'flex';
}

// Lấy thông tin tài khoản
async function fetchProfile() {
    if (!currentAuthToken) return;
    try {
        const res = await fetch('/api/profile', { headers: { 'Authorization': `Bearer ${currentAuthToken}` } });
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

// Cập nhật thông tin tài khoản
async function handleUpdateProfile(e) {
    e.preventDefault();
    const fullName = document.getElementById('profile-fullname').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const msgBox = document.getElementById('profile-msg');

    try {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentAuthToken}` },
            body: JSON.stringify({ fullName, email })
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message);

        msgBox.innerText = 'Cập nhật hồ sơ thành công!';
        msgBox.style.display = 'block';
        setTimeout(() => msgBox.style.display = 'none', 3000);
        fetchProfile();
    } catch (err) {
        alert('Lỗi cập nhật: ' + err.message);
    }
}

// Chuyển đổi tab
function switchTab(tabId) {
    document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

    const page = document.getElementById('page-' + tabId);
    const nav = document.getElementById('nav-' + tabId);
    if (page) page.classList.add('active');
    if (nav) nav.classList.add('active');

    if (tabId === 'dashboard' && typeof sensorChart !== 'undefined') setTimeout(() => sensorChart.resize(), 50);
    if (tabId === 'data') fetchDataSensor();
    if (tabId === 'history') fetchActiveHistory();
    if (tabId === 'profile') fetchProfile();
}

// Bật tắt thiết bị
async function toggleDevice(deviceCode, checkboxEl) {
    const isChecked = checkboxEl.checked;
    const action = isChecked ? 'ON' : 'OFF';
    try {
        const res = await fetch('/api/v1/devices/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${currentAuthToken}` },
            body: JSON.stringify({ deviceCode, action })
        });
        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.message);
    } catch (error) {
        alert('Lỗi điều khiển: ' + error.message);
        checkboxEl.checked = !isChecked;
    }
}

// Lấy trạng thái thiết bị
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

// Biểu đồ Chart.js
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
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { labels: { font: { family: "'Courier Prime', monospace" } } } },
        scales: {
            x: { ticks: { font: { family: "'Courier Prime', monospace" } } },
            y: { ticks: { font: { family: "'Courier Prime', monospace" } } }
        }
    }
});

function updateChart(data) {
    sensorChart.data.labels.push(new Date().toLocaleTimeString());
    sensorChart.data.datasets[0].data.push(data.temperature);
    sensorChart.data.datasets[1].data.push(data.humidity);
    sensorChart.data.datasets[2].data.push(data.lightLevel);
    if (sensorChart.data.labels.length > 10) {
        sensorChart.data.labels.shift();
        sensorChart.data.datasets.forEach(d => d.data.shift());
    }
    sensorChart.update();
}

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

// Lịch sử dữ liệu cảm biến
function sortData(col) {
    dataState.sortOrder = (dataState.sortBy === col && dataState.sortOrder === 'ASC') ? 'DESC' : 'ASC';
    dataState.sortBy = col;
    fetchDataSensor(1);
}

function resetSensorFilter() {
    ['filter-sensor-value', 'filter-sensor-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const typeEl = document.getElementById('filter-sensor-type');
    if (typeEl) typeEl.value = 'all';
    fetchDataSensor(1);
}

async function fetchDataSensor(page = dataState.page) {
    dataState.page = page;
    const type = document.getElementById('filter-sensor-type')?.value || 'all';
    const val = document.getElementById('filter-sensor-value')?.value || '';
    const time = document.getElementById('filter-sensor-time')?.value || '';
    const url = `/api/history/sensors?page=${page}&limit=${dataState.limit}&sensorType=${encodeURIComponent(type)}&keywordValue=${encodeURIComponent(val)}&keywordTime=${encodeURIComponent(time)}&sortBy=${dataState.sortBy}&sortOrder=${dataState.sortOrder}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        if (json.success) {
            const tbody = document.getElementById('table-data');
            if (!json.data || json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:25px;color:#8d6e63;">Không tìm thấy bản ghi nào</td></tr>';
            } else {
                tbody.innerHTML = json.data.map(row => {
                    const color = row.sensorType === 'humidity' ? '#0277bd' : (row.sensorType === 'light' ? '#e65100' : '#d84315');
                    return `<tr>
                        <td style="color:#9e9e9e;font-family:monospace;font-size:0.92rem;">${row.displayId || ('#' + String(row.id).padStart(3, '0'))}</td>
                        <td style="font-weight:500;color:#3e2723;">${row.sensorName}</td>
                        <td style="font-weight:700;color:${color};font-size:0.95rem;">${row.value} ${row.unit}</td>
                        <td style="color:#616161;font-family:monospace;">${fmtTime(row.recordedAt)}</td>
                    </tr>`;
                }).join('');
            }
            updatePagInfo('info-sensor-pag', json.pagination);
            renderPaginationModern('pag-data', json.pagination, fetchDataSensor);
        }
    } catch (e) {}
}

// Lịch sử bật tắt thiết bị
function sortHist(col) {
    histState.sortOrder = (histState.sortBy === col && histState.sortOrder === 'ASC') ? 'DESC' : 'ASC';
    histState.sortBy = col;
    fetchActiveHistory(1);
}

async function fetchActiveHistory(page = histState.page) {
    histState.page = page;
    const col = document.getElementById('search-hist-col').value;
    const kw = document.getElementById('search-hist-input').value;
    const url = `/api/history/actions?page=${page}&limit=${histState.limit}&searchBy=${col}&keyword=${encodeURIComponent(kw)}&sortBy=${histState.sortBy}&sortOrder=${histState.sortOrder}`;

    try {
        const res = await fetch(url);
        const json = await res.json();
        const tbody = document.getElementById('table-hist');
        if (json.success) {
            if (!json.data || json.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:25px;color:#8d6e63;">Chưa có lịch sử hoạt động</td></tr>';
            } else {
                tbody.innerHTML = json.data.map(row => {
                    const actBadge = badge(row.action, row.action === 'ON' ? '#2e7d32' : '#c62828');
                    const statColor = row.status === 'ON' ? '#2e7d32' : (row.status === 'OFF' ? '#c62828' : '#f57f17');
                    return `<tr>
                        <td><span class="dev-tag">${row.deviceId || row.deviceCode || 'DEV'}</span></td>
                        <td><b>${row.deviceName}</b></td>
                        <td>${actBadge}</td>
                        <td>${badge(row.status || 'loading', statColor)}</td>
                        <td style="font-family:monospace;">${fmtTime(row.time)}</td>
                        <td style="font-family:monospace;">${fmtTime(row.responseTime || row.time)}</td>
                    </tr>`;
                }).join('');
            }
            updatePagInfo('info-hist-pag', json.pagination);
            renderPaginationModern('pag-hist', json.pagination, fetchActiveHistory);
        } else if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:25px;color:#c62828;">${json.message || 'Lỗi tải dữ liệu'}</td></tr>`;
        }
    } catch (e) {}
}

// Phân trang
function renderPaginationModern(containerId, pagination, fetchFunc) {
    const container = document.getElementById(containerId);
    if (!container || !pagination || pagination.totalPages <= 0) return;
    container.innerHTML = '';
    const cur = pagination.currentPage, total = Math.min(pagination.totalPages, 5);

    const addBtn = (label, disabled, active, onClick) => {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (active ? ' active' : '');
        btn.innerHTML = label;
        btn.disabled = disabled;
        if (onClick) btn.onclick = onClick;
        container.appendChild(btn);
    };

    addBtn('&lt;', cur <= 1, false, () => fetchFunc(cur - 1));
    for (let i = 1; i <= total; i++) addBtn(i, false, i === cur, () => fetchFunc(i));
    addBtn('&gt;', cur >= total, false, () => fetchFunc(cur + 1));
}

// Khởi chạy hệ thống
checkAuth();
fetchDevices();
fetchSensorData();
setInterval(fetchSensorData, 3000);
