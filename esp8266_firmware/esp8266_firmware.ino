#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

//  CẤU HÌNH HỆ THỐNG 
const char* WIFI_SSID   = "Tainguyen";
const char* WIFI_PASS   = "03042005";
const char* MQTT_BROKER = "10.42.68.218"; // IP máy tính chạy Mosquitto (lệnh: ipconfig)
const int   MQTT_PORT   = 1884;
const char* MQTT_USER   = "tainguyen";
const char* MQTT_PASS   = "tainguyen";

// CHÂN NGOẠI VI 
#define DHT_PIN  D2   // DHT11
#define LDR_PIN  A0   // LM393 Quang trở
#define LED1_PIN D5   // Đèn 1 (LED_01)
#define LED2_PIN D6   // Đèn 2 (LED_02)

DHT dht(DHT_PIN, DHT11);
WiFiClient espClient;
PubSubClient mqtt(espClient);

unsigned long lastSensorTime = 0;
unsigned long lastReconnect  = 0;
bool led1State = false;
bool led2State = false;

// PHẢN HỒI TRẠNG THÁI 
void sendFeedback(const char* dev, bool state) {
  const char* st = state ? "ON" : "OFF";
  char buf[64];
  snprintf(buf, sizeof(buf), "%s: %s", dev, st);
  mqtt.publish("device/response", buf);

  // Đồng bộ trạng thái Web Backend
  StaticJsonDocument<64> doc;
  doc["deviceCode"] = strcmp(dev, "LED1") == 0 ? "LED_01" : "LED_02";
  doc["status"] = st;
  char jsonBuf[64];
  serializeJson(doc, jsonBuf);
  mqtt.publish("smarthome/device/status", jsonBuf);
  Serial.printf("[RESP] %s\n", buf);
}

// XỬ LÝ LỆNH ĐIỀU KHIỂN 
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char msg[128];
  int len = length < sizeof(msg) - 1 ? length : sizeof(msg) - 1;
  memcpy(msg, payload, len);
  msg[len] = '\0';
  String s = String(msg);
  s.toUpperCase();

  Serial.printf("[CMD] Topic: %s | Payload: %s\n", topic, msg);

  // 1. Điều khiển LED 1
  if (strstr(topic, "led1")) {
    led1State = (s.indexOf("ON") >= 0 || s == "1");
    digitalWrite(LED1_PIN, led1State ? HIGH : LOW);
    sendFeedback("LED1", led1State);
  } 
  // 2. Điều khiển LED 2
  else if (strstr(topic, "led2")) {
    led2State = (s.indexOf("ON") >= 0 || s == "1");
    digitalWrite(LED2_PIN, led2State ? HIGH : LOW);
    sendFeedback("LED2", led2State);
  } 
  // 3. Điều khiển CẢ 2 LED: {"led1":"ON","led2":"OFF"}
  else if (strstr(topic, "all")) {
    StaticJsonDocument<128> doc;
    if (!deserializeJson(doc, msg)) {
      if (doc.containsKey("led1")) {
        String v1 = doc["led1"].as<String>(); v1.toUpperCase();
        led1State = (v1 == "ON" || v1 == "1");
      }
      if (doc.containsKey("led2")) {
        String v2 = doc["led2"].as<String>(); v2.toUpperCase();
        led2State = (v2 == "ON" || v2 == "1");
      }
    } else {
      // Hỗ trợ trường hợp PowerShell làm mất ngoặc kép
      if (s.indexOf("LED1:ON") >= 0 || s.indexOf("LED1: ON") >= 0) led1State = true;
      if (s.indexOf("LED1:OFF") >= 0 || s.indexOf("LED1: OFF") >= 0) led1State = false;
      if (s.indexOf("LED2:ON") >= 0 || s.indexOf("LED2: ON") >= 0) led2State = true;
      if (s.indexOf("LED2:OFF") >= 0 || s.indexOf("LED2: OFF") >= 0) led2State = false;
      if (s == "ON" || s == "1") { led1State = true; led2State = true; }
      if (s == "OFF" || s == "0") { led1State = false; led2State = false; }
    }
    digitalWrite(LED1_PIN, led1State ? HIGH : LOW);
    digitalWrite(LED2_PIN, led2State ? HIGH : LOW);

    char allResp[64];
    snprintf(allResp, sizeof(allResp), "LED1: %s, LED2: %s", led1State ? "ON" : "OFF", led2State ? "ON" : "OFF");
    mqtt.publish("device/response", allResp);
    sendFeedback("LED1", led1State);
    sendFeedback("LED2", led2State);
  }
  // 4. Test Bước 4: gửi "HELLO" lên data/sensor
  else if (strstr(topic, "data/sensor") && s.indexOf("HELLO") >= 0) {
    mqtt.publish("device/response", "HELLO");
  }
}

//  ĐỌC VÀ GỬI SỐ ĐO CẢM BIẾN
void sendSensorData() {
  float temp = dht.readTemperature();
  float humi = dht.readHumidity();
  int light  = constrain(map(1023 - analogRead(LDR_PIN), 0, 1023, 50, 950), 0, 1000);

  if (isnan(temp) || isnan(humi)) { temp = 28.5; humi = 65.0; } // Fallback khi hở chân

  StaticJsonDocument<128> doc;
  doc["temperature"] = round(temp * 10.0) / 10.0;
  doc["humidity"]    = round(humi * 10.0) / 10.0;
  doc["light"]       = light;
  doc["lightLevel"]  = light;

  char buf[128];
  serializeJson(doc, buf);
  mqtt.publish("data/sensor", buf);
  mqtt.publish("smarthome/sensor/data", buf);

  Serial.printf("[SENSOR] Temp: %.1f C | Humi: %.1f%% | Light: %d Lux\n", temp, humi, light);
}

//  KẾT NỐI MẠNG 
void setupWiFi() {
  Serial.printf("\n[WiFi] Đang kết nối %s...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.printf(" OK! IP: %s\n", WiFi.localIP().toString().c_str());
}

bool reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return false;
  String id = "ESP8266_" + String(random(0xffff), HEX);
  Serial.print("[MQTT] Đang kết nối Broker... ");
  if (mqtt.connect(id.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("OK!");
    mqtt.subscribe("device/control/led1");
    mqtt.subscribe("device/control/led2");
    mqtt.subscribe("device/control/all");
    mqtt.subscribe("data/sensor");
    mqtt.subscribe("smarthome/device/control");
    return true;
  }
  Serial.printf("Lỗi rc=%d\n", mqtt.state());
  return false;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED1_PIN, OUTPUT);
  pinMode(LED2_PIN, OUTPUT);
  digitalWrite(LED1_PIN, LOW);
  digitalWrite(LED2_PIN, LOW);

  dht.begin();
  setupWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnect >= 5000) {
      lastReconnect = millis();
      Serial.println("[WiFi] Mất mạng, đang kết nối lại...");
      WiFi.reconnect();
    }
  } else {
    if (!mqtt.connected()) {
      if (millis() - lastReconnect >= 4000) {
        lastReconnect = millis();
        reconnectMQTT();
      }
    } else {
      mqtt.loop();
    }
  }

  if (millis() - lastSensorTime >= 3000) {
    lastSensorTime = millis();
    sendSensorData();
  }
}
