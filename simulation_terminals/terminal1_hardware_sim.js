/**
 * BÀI 2 - PHẦN 2.1 & 2.2: GIAO TIẾP MQTT
 * TERMINAL 1: MÀN HÌNH GIÁM SÁT DỮ LIỆU CẢM BIẾN (SENSOR MONITOR)
 * Sinh viên: Nguyễn Đức Tài - B23DCAT266
 * 
 * Chức năng:
 *   1. Subscribe topic: data/sensor (và smarthome/sensor/data)
 *   2. Hiển thị dữ liệu thực tế từ 2 cảm biến:
 *      - Cảm biến 1: DHT11 (Nhiệt độ °C và Độ ẩm %)
 *      - Cảm biến 2: LM393 (Cường độ ánh sáng Lux)
 *   3. Nhận dữ liệu thực tế từ ESP8266 (hoặc gõ phím 's' để phát giả lập nếu chưa cắm phần cứng)
 */

let mqtt;
try {
    mqtt = require('mqtt');
} catch (e) {
    mqtt = require('../backend/node_modules/mqtt');
}
const readline = require('readline');

const BROKER_URL        = process.env.MQTT_BROKER_URL || 'mqtt://tainguyen:tainguyen@localhost:1883';
const CLIENT_ID         = 'Terminal1_SensorMonitor_' + Math.random().toString(16).substr(2, 6);
const TOPIC_SENSOR_DATA = 'data/sensor';
const TOPIC_SMARTHOME   = 'smarthome/sensor/data';

console.clear();
console.log('========================================================================================================');
console.log('  TERMINAL 1: MÀN HÌNH GIÁM SÁT DỮ LIỆU CẢM BIẾN (SENSOR MONITOR)');
console.log('  - Cảm biến 1: DHT11 (Nhiệt độ, Độ ẩm)');
console.log('  - Cảm biến 2: LM393 (Cường độ ánh sáng)');
console.log('  - Giao thức: Mosquitto MQTT Broker (Xác thực user: tainguyen)');
console.log(`  - Subscribe: [${TOPIC_SENSOR_DATA}] & [${TOPIC_SMARTHOME}]`);
console.log('========================================================================================================');
console.log(`[KẾT NỐI] Đang kết nối tới Broker: ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, { clientId: CLIENT_ID, reconnectPeriod: 3000 });

let messageCount = 0;
let isSimulating = false;
let simInterval  = null;
let simStep      = 0;

client.on('connect', () => {
    console.log(`[KẾT NỐI] ✅ Đã kết nối Broker thành công! (ID: ${CLIENT_ID})`);
    
    client.subscribe([TOPIC_SENSOR_DATA, TOPIC_SMARTHOME], (err) => {
        if (!err) {
            console.log(`[SUBSCRIBE] Đang lắng nghe số đo cảm biến từ [${TOPIC_SENSOR_DATA}]`);
            console.log('[HƯỚNG DẪN] Gõ [s] + Enter để BẬT/TẮT dữ liệu ảo nếu chưa cắm ESP8266.');
            console.log('========================================================================================================');
            console.log('STT | THỜI GIAN | NHIỆT ĐỘ (DHT11) | ĐỘ ẨM (DHT11) | ÁNH SÁNG (LM393) | TRẠNG THÁI MÔI TRƯỜNG');
            console.log('----+-----------+------------------+---------------+------------------+-----------------------');
        }
    });
});

client.on('message', (topic, message) => {
    try {
        const raw = message.toString();
        // Nếu là gói test HELLO thì hiển thị thông báo
        if (raw.trim().toUpperCase() === 'HELLO') {
            const now = new Date().toLocaleTimeString();
            console.log(`[${now}] [TEST HELLO NHẬN ĐƯỢC TỪ TOPIC ${topic}] -> "HELLO"`);
            return;
        }

        const data = JSON.parse(raw);
        if (data.temperature === undefined && data.temp === undefined) return;

        messageCount++;
        const stt   = String(messageCount).padStart(3, '0');
        const now   = new Date().toLocaleTimeString();
        const temp  = (data.temperature !== undefined ? data.temperature : data.temp).toFixed(1);
        const humi  = (data.humidity !== undefined ? data.humidity : data.humi).toFixed(1);
        const light = Math.round(data.lightLevel !== undefined ? data.lightLevel : data.light);

        let envStatus = 'Bình thường';
        if (parseFloat(temp) >= 32.0) {
            envStatus = 'Nhiệt độ cao (Nóng)';
        } else if (light < 200) {
            envStatus = 'Thiếu sáng (Tối)';
        } else if (light > 800) {
            envStatus = 'Ánh sáng mạnh';
        }

        console.log(`${stt} | ${now} | ${(temp + ' °C').padEnd(16, ' ')} | ${(humi + '%').padEnd(13, ' ')} | ${(light + ' Lux').padEnd(16, ' ')} | ${envStatus}`);
    } catch (e) {
        // Bỏ qua gói lỗi JSON
    }
});

function toggleSimulation() {
    isSimulating = !isSimulating;
    if (isSimulating) {
        console.log('\n>>> [GIẢ LẬP] ĐÃ BẬT chế độ phát dữ liệu ảo (3 giây/lần)... <<<\n');
        simInterval = setInterval(() => {
            simStep++;
            const temp  = parseFloat((28.5 + Math.sin(simStep * 0.2) * 2.0).toFixed(1));
            const humi  = parseFloat((65.0 + Math.cos(simStep * 0.15) * 5.0).toFixed(1));
            const light = Math.round(500 + Math.sin(simStep * 0.3) * 150);

            const payload = JSON.stringify({
                temperature: temp,
                humidity: humi,
                lightLevel: light,
                light: light,
                timestamp: new Date().toISOString()
            });

            client.publish(TOPIC_SENSOR_DATA, payload);
            client.publish(TOPIC_SMARTHOME, payload);
        }, 3000);
    } else {
        console.log('\n>>> [GIẢ LẬP] ĐÃ TẮT chế độ phát dữ liệu ảo. Đang chờ ESP8266 thật... <<<\n');
        if (simInterval) clearInterval(simInterval);
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === 's') {
        toggleSimulation();
    }
});

client.on('error', (err) => console.error('[LỖI MQTT]', err.message));
