/**
 * TERMINAL 3: DEVICE RESPONSE (Giám sát phản hồi thiết bị)
 * Sinh viên: Nguyễn Đức Tài - B23DCAT266
 * 
 * Lắng nghe:
 *   - Topic: device/response (theo đúng đề bài mosquitto_sub)
 *   - Topic: smarthome/device/status
 */

let mqtt;
try {
    mqtt = require('mqtt');
} catch (e) {
    mqtt = require('../backend/node_modules/mqtt');
}

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://tainguyen:tainguyen@localhost:1883';
const CLIENT_ID  = 'Device_Response_' + Math.random().toString(16).substr(2, 6);

const TOPICS = [
    'device/response',
    'smarthome/device/status',
    'smarthome/device/response'
];

console.clear();
console.log('=== TERMINAL 3: DEVICE RESPONSE (GIÁM SÁT PHẢN HỒI THIẾT BỊ) ===');
console.log(`[MQTT] Đang kết nối tới Broker: ${BROKER_URL}`);

const client = mqtt.connect(BROKER_URL, { clientId: CLIENT_ID, reconnectPeriod: 3000 });

client.on('connect', () => {
    client.subscribe(TOPICS, (err) => {
        if (!err) {
            console.log(`[MQTT] ✅ Đã kết nối và subscribe các topic:`);
            TOPICS.forEach(t => console.log(`  - ${t}`));
            console.log('--------------------------------------------------');
            console.log('Đang chờ phản hồi từ ESP8266 phần cứng hoặc Terminal 2...');
        }
    });
});

let lastPrintedMsg = '';
let lastPrintedTime = 0;

function printOutput(msg) {
    const now = Date.now();
    // Chống lặp gói tin giống hệt nhau trong 300ms
    if (msg === lastPrintedMsg && (now - lastPrintedTime) < 300) {
        return;
    }
    lastPrintedMsg  = msg;
    lastPrintedTime = now;

    const timeStr = new Date().toLocaleTimeString();
    console.log(`[${timeStr}] [PHẢN HỒI THỰC TẾ] -> ${msg}`);
}

client.on('message', (topic, payload) => {
    try {
        const raw = payload.toString().trim();
        let data = null;

        try {
            data = JSON.parse(raw);
        } catch (_) {}

        // 1. Nếu là JSON cập nhật trạng thái thiết bị {deviceCode, status}
        if (data && data.deviceCode && data.status) {
            printOutput(`${data.deviceCode}: ${data.status.toUpperCase()}`);
            return;
        }

        // 2. Nếu là text thuần (ví dụ: "LED1: ON", "LED2: OFF", "LED1: ON, LED2: OFF", "HELLO")
        if (raw.length > 0) {
            printOutput(raw);
        }
    } catch (e) {}
});

client.on('error', (err) => console.error('[LỖI MQTT]', err.message));
