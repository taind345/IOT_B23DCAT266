const mqtt = require('mqtt');
const db = require('../config/database');

class MqttService {
    constructor() {
        this.client = null;
        this.lastHardwareDataTime = 0;
        // Hỗ trợ Mosquitto Broker có xác thực mặc định hoặc cấu hình qua biến môi trường
        const defaultHost = process.env.MQTT_HOST || 'localhost';
        const defaultPort = process.env.MQTT_PORT || '1883';
        const defaultUser = process.env.MQTT_USER || 'tainguyen';
        const defaultPass = process.env.MQTT_PASS || 'tainguyen';

        this.brokerUrl = process.env.MQTT_BROKER_URL || `mqtt://${defaultUser}:${defaultPass}@${defaultHost}:${defaultPort}`;
        
        // Danh sách topic đồng bộ với đề bài thực hành Mosquitto và hệ thống Web
        this.TOPIC_SENSOR_DATA       = 'smarthome/sensor/data';
        this.TOPIC_DATA_SENSOR_ALT   = 'data/sensor';
        this.TOPIC_DEVICE_CONTROL    = 'smarthome/device/control';
        this.TOPIC_DEVICE_STATUS     = 'smarthome/device/status';
        this.TOPIC_DEVICE_RESPONSE   = 'device/response';
    }

    init() {
        try {
            console.log(`[MQTT] Đang kết nối tới Broker: ${this.brokerUrl}...`);
            this.client = mqtt.connect(this.brokerUrl, {
                clientId: 'NodeJS_Backend_SmartHome_' + Math.random().toString(16).substr(2, 8),
                reconnectPeriod: 5000,
                connectTimeout: 10000
            });

            this.client.on('connect', () => {
                console.log(`[MQTT] ✅ Đã kết nối thành công tới Broker: ${this.brokerUrl}`);
                const topics = [
                    this.TOPIC_SENSOR_DATA,
                    this.TOPIC_DATA_SENSOR_ALT,
                    this.TOPIC_DEVICE_STATUS,
                    this.TOPIC_DEVICE_RESPONSE
                ];

                this.client.subscribe(topics, (err) => {
                    if (!err) {
                        console.log(`[MQTT] 📡 Đã đăng ký lắng nghe các topic:`);
                        console.log(`  - ${this.TOPIC_SENSOR_DATA} & ${this.TOPIC_DATA_SENSOR_ALT} (Nhận telemetry từ ESP8266)`);
                        console.log(`  - ${this.TOPIC_DEVICE_STATUS} & ${this.TOPIC_DEVICE_RESPONSE} (Nhận phản hồi thiết bị)`);
                    }
                });
            });

            this.client.on('message', async (topic, payload) => {
                await this.handleMessage(topic, payload.toString());
            });

            this.client.on('error', (err) => {
                console.warn(`[MQTT CẢNH BÁO] Lỗi kết nối MQTT: ${err.message}. Hệ thống vẫn chạy bình thường.`);
            });

            this.client.on('offline', () => {
                console.log(`[MQTT] Mất kết nối tới Broker, đang tự động kết nối lại...`);
            });
        } catch (e) {
            console.warn(`[MQTT] Không thể khởi động MQTT Client: ${e.message}`);
        }
    }

    async handleMessage(topic, messageStr) {
        try {
            // 1. Xử lý dữ liệu cảm biến từ cả smarthome/sensor/data và data/sensor
            if (topic === this.TOPIC_SENSOR_DATA || topic === this.TOPIC_DATA_SENSOR_ALT) {
                let data = null;
                try {
                    data = JSON.parse(messageStr);
                } catch (_) {
                    return;
                }

                const temp = parseFloat(data.temperature !== undefined ? data.temperature : data.temp);
                const humi = parseFloat(data.humidity !== undefined ? data.humidity : data.humi);
                const light = parseFloat(data.lightLevel !== undefined ? data.lightLevel : data.light);

                if (!isNaN(temp) && !isNaN(humi) && !isNaN(light)) {
                    this.lastHardwareDataTime = Date.now();

                    // Lưu vào bảng sensor_data liên kết với danh mục bảng sensors
                    await db.execute(
                        'INSERT INTO sensor_data (sensor_id, value, recorded_at) VALUES (1, ?, NOW()), (2, ?, NOW()), (3, ?, NOW())',
                        [temp, humi, light]
                    );

                    // Giữ tối đa 40 bản ghi gần nhất (chuẩn 5 trang x 8 dòng/trang)
                    await db.execute(`
                        DELETE FROM sensor_data 
                        WHERE id NOT IN (
                            SELECT id FROM (
                                SELECT id FROM sensor_data ORDER BY id DESC LIMIT 40
                            ) AS keep_rows
                        )
                    `);

                    console.log(`[MQTT TELEMETRY] ESP8266 -> Temp: ${temp}°C, Humi: ${humi}%, Light: ${light} Lux`);
                }
            } 
            // 2. Xử lý phản hồi trạng thái thiết bị JSON (smarthome/device/status)
            else if (topic === this.TOPIC_DEVICE_STATUS) {
                try {
                    const data = JSON.parse(messageStr);
                    const { deviceCode, status } = data;
                    if (deviceCode && status) {
                        await db.execute('UPDATE devices SET status = ? WHERE device_code = ?', [status, deviceCode]);
                        console.log(`[MQTT TRẠNG THÁI THỰC] Cập nhật thiết bị ${deviceCode} -> ${status}`);
                    }
                } catch (_) {}
            }
            // 3. Xử lý phản hồi chuỗi Text từ Terminal 3 (device/response)
            else if (topic === this.TOPIC_DEVICE_RESPONSE) {
                const raw = messageStr.trim();
                // Ví dụ: "LED1: ON", "LED2: OFF", "ALL: LED1: ON, LED2: OFF"
                if (raw.includes('LED1: ON')) {
                    await db.execute('UPDATE devices SET status = ? WHERE device_code = ?', ['ON', 'LED_01']);
                } else if (raw.includes('LED1: OFF')) {
                    await db.execute('UPDATE devices SET status = ? WHERE device_code = ?', ['OFF', 'LED_01']);
                }

                if (raw.includes('LED2: ON')) {
                    await db.execute('UPDATE devices SET status = ? WHERE device_code = ?', ['ON', 'LED_02']);
                } else if (raw.includes('LED2: OFF')) {
                    await db.execute('UPDATE devices SET status = ? WHERE device_code = ?', ['OFF', 'LED_02']);
                }
            }
        } catch (err) {
            // Tránh văng lỗi nếu chuỗi JSON hoặc câu query lỗi
        }
    }

    // Gửi lệnh điều khiển phần cứng xuống ESP8266
    publishDeviceControl(deviceCode, action) {
        if (!this.client || !this.client.connected) {
            console.log(`[MQTT] Không thể gửi lệnh: Chưa kết nối tới MQTT Broker`);
            return false;
        }

        const payload = JSON.stringify({
            deviceCode: deviceCode,
            action: action,
            timestamp: new Date().toISOString()
        });

        // Gửi lên topic chuẩn của Web Backend
        this.client.publish(this.TOPIC_DEVICE_CONTROL, payload, { qos: 1 });

        // Đồng thời gửi tương thích lên các topic terminal bài thực hành
        if (deviceCode === 'LED_01') {
            this.client.publish('device/control/led1', action);
        } else if (deviceCode === 'LED_02') {
            this.client.publish('device/control/led2', action);
        }

        console.log(`[MQTT GỬI LỆNH] Đã phát lệnh điều khiển ${deviceCode} -> ${action}`);
        return true;
    }

    // Kiểm tra xem phần cứng ESP8266 có đang truyền dữ liệu thật hay không
    isHardwareActive() {
        return (Date.now() - this.lastHardwareDataTime) < 15000; // Trong vòng 15 giây gần nhất
    }
}

module.exports = new MqttService();
