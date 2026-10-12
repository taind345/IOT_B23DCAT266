const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/config/database');
const sensorRoutes = require('./src/routes/sensorRoutes');
const historyRoutes = require('./src/routes/historyRoutes');
const authRoutes = require('./src/routes/authRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares
app.use(cors());
app.use(express.json());

// 2. Phục vụ thư mục Frontend (chạy chung host với Backend)
app.use(express.static(path.join(__dirname, '../frontend')));

// 3. Khai báo các API Routes thực tế
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/v1/sensors', sensorRoutes);
app.use('/api/sensors', sensorRoutes); // Alias theo MASTER_DOCUMENT
app.use('/api/history', historyRoutes);

const mqttService = require('./src/services/mqttService');

// API Lấy danh sách thiết bị
app.get('/api/devices', async (req, res) => {
    try {
        const [devices] = await db.execute('SELECT * FROM devices');
        res.status(200).json({ success: true, data: devices });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Lỗi server' });
    }
});

// API Toggle thiết bị: Cập nhật trạng thái, ghi log action_history và phát lệnh MQTT xuống ESP8266
app.post('/api/v1/devices/toggle', async (req, res) => {
    try {
        const { deviceCode, action } = req.body;
        console.log(`[MQTT / DEVICE] Điều khiển ${action} cho thiết bị ${deviceCode}`);

        // 1. Cập nhật bảng devices
        await db.execute('UPDATE devices SET status = ? WHERE device_code = ?', [action, deviceCode]);

        // 2. Ghi nhật ký vào action_history với device_id là mã thiết bị (FAN_01, LED_01, LED_02)
        await db.execute(
            'INSERT INTO action_history (device_id, user_id, action, status, source, created_at, response_time) VALUES (?, 1, ?, ?, "manual", NOW(), DATE_ADD(NOW(), INTERVAL 1 SECOND))',
            [deviceCode, action, action]
        );

        // 3. Phát lệnh xuống phần cứng ESP8266 qua MQTT
        mqttService.publishDeviceControl(deviceCode, action);

        res.status(200).json({
            success: true,
            message: "Đã thực thi điều khiển thiết bị thành công",
            data: { deviceCode, action }
        });
    } catch (err) {
        console.error('Lỗi khi điều khiển thiết bị:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi điều khiển thiết bị' });
    }
});

// 4. Khai báo Swagger UI Docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// --- BỘ GIẢ LẬP DỮ LIỆU CẢM BIẾN TỰ ĐỘNG (SENSOR DATA SIMULATOR) ---
// Tự động sinh dữ liệu nhiệt độ, độ ẩm, ánh sáng biến thiên tự nhiên mỗi 3 giây
// (Tự động tạm dừng khi nhận thấy phần cứng ESP8266 thật đang gửi số đo thực tế)
let simStep = 0;
function startSensorSimulator() {
    setInterval(async () => {
        try {
            // Nếu phần cứng ESP8266 thực tế đang hoạt động, tạm ngưng bộ giả lập
            if (mqttService.isHardwareActive()) {
                return;
            }

            simStep++;
            // Tạo sóng biến thiên chân thực
            const temp = (27.5 + Math.sin(simStep * 0.18) * 3.2 + (Math.random() - 0.5) * 0.4).toFixed(1);
            const humi = (65.0 + Math.cos(simStep * 0.14) * 6.0 + (Math.random() - 0.5) * 0.5).toFixed(1);
            const light = Math.round(500.0 + Math.sin(simStep * 0.22) * 80.0 + (Math.random() - 0.5) * 10.0);

            await db.execute(
                'INSERT INTO sensor_data (sensor_id, value, recorded_at) VALUES (1, ?, NOW()), (2, ?, NOW()), (3, ?, NOW())',
                [temp, humi, light]
            );

            // Giữ tối đa 40 bản ghi gần nhất (tương ứng đúng 5 trang x 8 bản ghi/trang)
            await db.execute(`
                DELETE FROM sensor_data 
                WHERE id NOT IN (
                    SELECT id FROM (
                        SELECT id FROM sensor_data ORDER BY id DESC LIMIT 40
                    ) AS keep_rows
                )
            `);
        } catch (err) {
            // Không ngắt server nếu MySQL tạm thời bận
        }
    }, 3000);
}

// 5. Khởi động Server
app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`🚀 Máy chủ Backend khởi chạy thành công!`);
    console.log(`🌍 Trang Dashboard: http://localhost:${PORT}`);
    console.log(`📑 Tài liệu API (Swagger): http://localhost:${PORT}/api-docs`);
    console.log(`===========================================`);

    // Khởi động kết nối MQTT với ESP8266
    mqttService.init();

    // Kích hoạt giả lập dữ liệu cảm biến
    startSensorSimulator();
    console.log(`🔄 Bộ tạo dữ liệu cảm biến thời gian thực đã kích hoạt (chu kỳ 3s).`);
});

