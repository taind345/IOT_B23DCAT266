# SƠ ĐỒ TỔNG THỂ HỆ THỐNG IOT SMART HOME

Tài liệu mô tả chi tiết **Kiến trúc tổng thể hệ thống IoT Smart Home**, bao gồm sơ đồ thành phần 5 tầng chuẩn hóa, sơ đồ luồng dữ liệu truyền nhận (Sequence Diagram), cùng giải thích chức năng chi tiết của từng khối trong hệ thống.

---

## 1. Sơ đồ Kiến trúc Tổng thể (Overall Architecture Diagram)

```mermaid
flowchart TB
    %% --- TẦNG GIAO DIỆN ---
    subgraph Presentation["5. Tầng Giao diện (Frontend Web Client)"]
        WebUI["Web Dashboard & Management<br/>(HTML5 / CSS3 Retro / JS / Bootstrap 5 / Chart.js)"]
    end

    %% --- TẦNG BACKEND ---
    subgraph Backend["3. Tầng Máy chủ Backend (Node.js & Express)"]
        direction TB
        Express_App["Express REST API Server<br/>(Routing, Auth JWT, Controller)"]
        Mapper["Data Mapper<br/>(snake_case ↔ camelCase)"]
        MQTT_Client["MQTT Client Service<br/>(Publish Lệnh & Subscribe Dữ liệu)"]
        
        Express_App <-->|"Xử lý dữ liệu"| Mapper
        Express_App -->|"Gửi lệnh điều khiển"| MQTT_Client
        MQTT_Client <-->|"Chuyển đổi payload"| Mapper
    end

    %% --- TẦNG TRUYỀN THÔNG & CƠ SỞ DỮ LIỆU ---
    subgraph Broker["2. Tầng MQTT Broker"]
        MQTT["MQTT Broker<br/>(Mosquitto / HiveMQ)"]
    end

    subgraph Storage["4. Tầng Cơ sở dữ liệu (MySQL / MariaDB)"]
        DB[(MySQL Database)]
        tbl_users["bảng users"]
        tbl_devices["bảng devices"]
        tbl_sensor["bảng sensor_data"]
        tbl_history["bảng action_history"]
        
        DB --- tbl_users
        DB --- tbl_devices
        DB --- tbl_sensor
        DB --- tbl_history
    end

    %% --- TẦNG PHẦN CỨNG ---
    subgraph Hardware["1. Tầng Phần cứng (ESP32 Firmware)"]
        DHT11["Cảm biến DHT11<br/>(Nhiệt độ & Độ ẩm)"]
        LDR["Cảm biến LDR<br/>(Cường độ ánh sáng)"]
        ESP32["Vi điều khiển ESP32<br/>(C++ / Arduino Core)"]
        Actuators["Thiết bị chấp hành<br/>(Đèn LED_01, LED_02 & Quạt FAN_01)"]
        
        DHT11 -->|"Đọc chu kỳ (5-10s)"| ESP32
        LDR -->|"Đọc chu kỳ (5-10s)"| ESP32
        ESP32 -->|"Điều khiển GPIO / Relay"| Actuators
    end

    %% --- KẾT NỐI LIÊN TẦNG ---
    WebUI <-->|"HTTP REST API<br/>(Short-Polling 3-5s & Controls)"| Express_App
    
    Mapper <-->|"SQL Queries<br/>(CRUD Operations)"| DB

    MQTT_Client -->|"Pub: smarthome/device/control (QoS 1)"| MQTT
    MQTT -->|"Sub: smarthome/sensor/data (QoS 0)<br/>Sub: smarthome/device/status (QoS 1)<br/>Sub: smarthome/device/connection (QoS 1)"| MQTT_Client

    ESP32 -->|"Pub: smarthome/sensor/data<br/>Pub: smarthome/device/status<br/>LWT: smarthome/device/connection"| MQTT
    MQTT -->|"Sub: smarthome/device/control"| ESP32
```

---

## 2. Sơ đồ Luồng Truyền Nhận Dữ Liệu (Sequence Diagram)

Sơ đồ thể hiện 2 luồng tương tác chính trong hệ thống: **Ghi nhận số liệu cảm biến** và **Điều khiển thiết bị & Đồng bộ trạng thái thực tế**.

```mermaid
sequenceDiagram
    autonumber
    participant ESP32 as ESP32 (Hardware)
    participant Broker as MQTT Broker
    participant BE as Node.js Backend
    participant DB as MySQL Database
    participant FE as Frontend Web

    rect rgb(240, 248, 255)
    note over ESP32, FE: LUỒNG 1: THU THẬP & HIỂN THỊ DỮ LIỆU CẢM BIẾN (UPLINK & POLLING)
    ESP32->>Broker: 1. Publish JSON {temperature, humidity, lightLevel} (smarthome/sensor/data) [QoS 0]
    Broker->>BE: 2. Forward Message đến MQTT Client Backend
    BE->>DB: 3. INSERT INTO sensor_data (temperature, humidity, light)
    BE-->>BE: 4. Cập nhật Cache dữ liệu mới nhất
    FE->>BE: 5. GET /api/v1/sensors/data/latest (HTTP Short-Polling 3s)
    BE-->>FE: 6. Response JSON {temperature, humidity, lightLevel, recordedAt}
    FE-->>FE: 7. Cập nhật thẻ chỉ số & Vẽ lại đồ thị Chart.js
    end

    rect rgb(255, 245, 238)
    note over ESP32, FE: LUỒNG 2: ĐIỀU KHIỂN THIẾT BỊ & ĐỒNG BỘ TRẠNG THÁI THỰC TẾ (DOWNLINK)
    FE->>BE: 8. POST /api/v1/devices/toggle hoặc PUT /api/devices/:code/control
    BE->>DB: 9. INSERT INTO action_history (device_id, user_id, action, source)
    BE->>Broker: 10. Publish JSON {deviceCode, action} xuống smarthome/device/control [QoS 1]
    BE-->>FE: 11. Response HTTP 200 OK (Xác nhận đã gửi lệnh)
    Broker->>ESP32: 12. Forward Message đến ESP32
    ESP32->>ESP32: 13. Thực thi kích hoạt GPIO / Relay (Bật/Tắt Đèn hoặc Quạt)
    ESP32->>Broker: 14. Publish JSON {deviceCode, status} lên smarthome/device/status [QoS 1]
    Broker->>BE: 15. Forward Message xác nhận đến Backend
    BE->>DB: 16. UPDATE devices SET status = 'ON/OFF' WHERE device_code = ...
    FE->>BE: 17. GET /api/devices (Định kỳ đồng bộ)
    BE-->>FE: 18. Response JSON trạng thái mới nhất
    FE-->>FE: 19. Cập nhật trạng thái công tắc Toggle trên giao diện
    end
```

---

## 3. Diễn giải Chi tiết Các Khối Thành Phần

### 3.1. Tầng Phần cứng (ESP32 Firmware)
* **Cảm biến:** 
  * `DHT11`: Đo nhiệt độ (°C) và độ ẩm (%).
  * `LDR (Quang trở)`: Đo cường độ ánh sáng (lux).
* **Thiết bị chấp hành:** `Đèn LED_01`, `Đèn LED_02` và `Quạt FAN_01` kết nối qua các chân GPIO / Module Relay của ESP32.
* **Tác vụ chính:** 
  * Định kỳ 5–10 giây đọc cảm biến và gộp thành 1 payload JSON duy nhất gửi lên `smarthome/sensor/data` (giảm tải số lượng message gửi lên Broker).
  * Lắng nghe lệnh điều khiển từ `smarthome/device/control` để bật/tắt đúng thiết bị.
  * Phản hồi trạng thái thực tế sau khi kích hoạt phần cứng lên `smarthome/device/status`.
  * Đăng ký cơ chế **Last Will and Testament (LWT)** tại topic `smarthome/device/connection` để thông báo trạng thái Online/Offline khi mất nguồn/mất mạng đột ngột.

### 3.2. Tầng MQTT Broker
* Trung gian truyền nhận message giữa ESP32 và Node.js Backend theo mô hình Publish/Subscribe.
* Sử dụng **QoS 0** cho dữ liệu cảm biến (tần suất gửi lặp lại liên tục) và **QoS 1** cho các lệnh điều khiển / xác nhận trạng thái (đảm bảo không bị thất lạc lệnh quan trọng).

### 3.3. Tầng Máy chủ Backend (Node.js & Express)
* **Express REST API Server:** Cung cấp các endpoint theo chuẩn RESTful cho Frontend:
  * `POST /api/auth/login`: Đăng nhập, cấp JWT token (hạn 24h).
  * `GET /api/devices` & `PUT /api/devices/:deviceCode/control`: Quản lý và điều khiển thiết bị.
  * `GET /api/sensors/latest` (hoặc `/api/v1/sensors/data/latest`): Lấy dữ liệu cảm biến mới nhất phục vụ polling.
  * `GET /api/history/sensors`: Lịch sử dữ liệu cảm biến (hỗ trợ tìm kiếm đa cột, sắp xếp ASC/DESC, phân trang 50 dòng/trang).
  * `GET /api/history/actions`: Lịch sử hoạt động bật/tắt thiết bị (phân trang 20 dòng/trang).
  * `GET /api/profile` & `PUT /api/profile`: Xem và cập nhật hồ sơ cá nhân.
  * Phục vụ static file Frontend Web và tài liệu Swagger UI tại `/api-docs`.
* **MQTT Client Service:** Lắng nghe dữ liệu cảm biến từ ESP32 để lưu vào Database, đồng thời phát lệnh điều khiển xuống ESP32 khi có yêu cầu từ API.
* **Data Mapper:** Chuyển đổi định dạng tên giữa `snake_case` (trong MySQL) và `camelCase` (trong JSON API & MQTT).

### 3.4. Tầng Cơ sở dữ liệu (MySQL / MariaDB)
Lưu trữ **4 bảng chính** có ràng buộc khóa ngoại (Foreign Key) và chỉ mục (Index) tối ưu:
1. `users`: Quản lý tài khoản, mật khẩu (mã hóa Bcrypt), vai trò (`admin`/`user`).
2. `devices`: Quản lý danh mục thiết bị (`LED_01`, `LED_02`, `FAN_01`), vị trí và trạng thái thực tế (`ON`/`OFF`).
3. `sensor_data`: Thiết kế dạng phẳng (**Flattened Schema**: `id`, `temperature`, `humidity`, `light`, `recorded_at`) có đánh Index trường thời gian, tối ưu hóa truy vấn hiển thị bảng 5 cột.
4. `action_history`: Lưu nhật ký mọi hành động bật/tắt thiết bị (liên kết với `devices` và `users`).

### 3.5. Tầng Giao diện (Frontend Web Client)
* Xây dựng theo kiến trúc Single Page Application (SPA) bằng HTML5, CSS3 Retro/Vintage, JavaScript thuần và thư viện đồ thị Chart.js.
* **Cơ chế Cập nhật dữ liệu (Near Real-time):** Sử dụng **HTTP Short-Polling** (gọi API định kỳ 3 giây qua `setInterval`) để tự động làm mới thẻ thông số, vẽ lại đồ thị Chart.js và đồng bộ công tắc bật/tắt mà không cần tải lại trang.
