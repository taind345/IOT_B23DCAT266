/**
 * TERMINAL 2: DEVICE CONTROL
 * Sinh viên: Nguyễn Đức Tài - B23DCAT266
 */

let mqtt;
try {
    mqtt = require('mqtt');
} catch (e) {
    mqtt = require('../backend/node_modules/mqtt');
}
const readline = require('readline');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://tainguyen:tainguyen@localhost:1883';
const CLIENT_ID  = 'Device_Control_' + Math.random().toString(16).substr(2, 6);

const TOPIC_LED1          = 'device/control/led1';
const TOPIC_LED2          = 'device/control/led2';
const TOPIC_ALL           = 'device/control/all';
const TOPIC_CONTROL_FULL  = 'smarthome/device/control';
const TOPIC_RESP          = 'device/response';

console.clear();
console.log('=== TERMINAL 2: DEVICE CONTROL ===');
console.log(`[MQTT] Đang kết nối: ${BROKER_URL}`);

const client = mqtt.connect(BROKER_URL, { clientId: CLIENT_ID, reconnectPeriod: 3000 });

function showMenu() {
    console.log('\nDANH SÁCH PHÍM ĐIỀU KHIỂN:');
    console.log('  [1] BẬT Đèn 1 (device/control/led1 -> ON)');
    console.log('  [0] TẮT Đèn 1 (device/control/led1 -> OFF)');
    console.log('  [2] BẬT Đèn 2 (device/control/led2 -> ON)');
    console.log('  [3] TẮT Đèn 2 (device/control/led2 -> OFF)');
    console.log('  [4] BẬT CẢ 2 Đèn (device/control/all -> {"led1":"ON","led2":"ON"})');
    console.log('  [5] TẮT CẢ 2 Đèn (device/control/all -> {"led1":"OFF","led2":"OFF"})');
    console.log('  [6] Test {"led1":"ON","led2":"OFF"}');
    console.log('  Gõ chữ bất kỳ (vd: "HELLO") để gửi test lên data/sensor.');
    console.log('--------------------------------------------------');
}

client.on('connect', () => {
    console.log('[MQTT] ✅ Đã kết nối Broker thành công!');
    client.subscribe([TOPIC_RESP], (err) => {
        if (!err) {
            showMenu();
        }
    });
});

client.on('message', (topic, message) => {
    const raw = message.toString().trim();
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] [PHẢN HỒI NHẬN ĐƯỢC] ${raw}`);
});

function sendLed1(action) {
    client.publish(TOPIC_LED1, action);
    client.publish(TOPIC_CONTROL_FULL, JSON.stringify({ deviceCode: 'LED_01', action: action }));
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] [GỬI] Topic: ${TOPIC_LED1} | Lệnh: ${action}`);
}

function sendLed2(action) {
    client.publish(TOPIC_LED2, action);
    client.publish(TOPIC_CONTROL_FULL, JSON.stringify({ deviceCode: 'LED_02', action: action }));
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] [GỬI] Topic: ${TOPIC_LED2} | Lệnh: ${action}`);
}

function sendAll(jsonObj) {
    const payload = JSON.stringify(jsonObj);
    client.publish(TOPIC_ALL, payload);
    const now = new Date().toLocaleTimeString();
    console.log(`[${now}] [GỬI] Topic: ${TOPIC_ALL} | Lệnh: ${payload}`);
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    const cmd = line.trim();
    if (!cmd) return;

    if (cmd === '1') {
        sendLed1('ON');
    } else if (cmd === '0') {
        sendLed1('OFF');
    } else if (cmd === '2') {
        sendLed2('ON');
    } else if (cmd === '3') {
        sendLed2('OFF');
    } else if (cmd === '4') {
        sendAll({ led1: 'ON', led2: 'ON' });
    } else if (cmd === '5') {
        sendAll({ led1: 'OFF', led2: 'OFF' });
    } else if (cmd === '6') {
        sendAll({ led1: 'ON', led2: 'OFF' });
    } else {
        // Gửi text lên data/sensor (như lệnh test HELLO)
        client.publish('data/sensor', cmd);
        console.log(`[GỬI TEST] Topic: data/sensor | Nội dung: ${cmd}`);
    }
});

client.on('error', (err) => console.error('[LỖI MQTT]', err.message));
