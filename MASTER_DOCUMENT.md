# MASTER DOCUMENT — Hệ thống IoT Smart Home

| | |
|---|---|
| **Phiên bản** | 1.0 |
| **Vai trò tài liệu** | Chuẩn thiết kế xuyên suốt dự án (Single Source of Truth) |
| **Tech Stack** | ESP32 (C++/Arduino) · MQTT · Node.js (Express) · MySQL · HTML/JS + Bootstrap 5 + Chart.js |

> **Nguyên tắc bắt buộc:** Mọi module trong dự án (Firmware, Backend, Frontend) khi cần tên bảng, tên cột, tên topic hoặc tên field JSON đều phải tra cứu tài liệu này trước, không tự đặt tên mới. Nếu phát sinh nhu cầu thay đổi, phải cập nhật tài liệu này trước rồi mới sửa code.

---

## Quy ước đặt tên (Naming Convention)

| Phạm vi | Quy ước | Ví dụ |
|---|---|---|
| Tên bảng & cột trong MySQL | `snake_case` | `device_code`, `created_at` |
| Tên field trong JSON (MQTT payload & REST API) | `camelCase` | `deviceCode`, `createdAt` |
| Tên topic MQTT | `snake_case` nối bằng dấu `/` | `smarthome/device/control` |
| Tên endpoint REST | `kebab-case`/số nhiều, `camelCase` cho query param | `/api/history/sensors?sensorType=...` |

Lớp Backend (Node.js) chịu trách nhiệm **chuyển đổi** giữa hai quy ước này (đọc `snake_case` từ MySQL → trả về `camelCase` trong JSON, và ngược lại khi ghi dữ liệu). Đây là ranh giới duy nhất diễn ra việc mapping tên.

---

## PHẦN 1: ARCHITECTURE OVERVIEW

### 1.1. Sơ đồ luồng dữ liệu tổng quát

```
┌─────────────┐      MQTT (publish)       ┌──────────────┐      MQTT (subscribe)      ┌─────────────────┐
│   ESP32     │ ─────────────────────────▶│              │◀───────────────────────── │                 │
│ - DHT11     │  smarthome/sensor/data     │  MQTT Broker │  smarthome/device/control  │  Node.js Backend│
│ - LDR       │◀───────────────────────── │              │ ─────────────────────────▶│   (Express)     │
│ - 3x LED    │  smarthome/device/control  └──────────────┘  smarthome/device/status   │                 │
└─────────────┘                                                                        └────────┬────────┘
                                                                                                   │
                                                                                     ┌─────────────┼─────────────┐
                                                                                     │                           │
                                                                                     ▼                           ▼
                                                                            ┌─────────────────┐        ┌──────────────────┐
                                                                            │   MySQL Database │        │   Frontend (Web)  │
                                                                            │  (5 bảng dữ liệu) │        │  HTTP/REST (JSON) │
                                                                            └─────────────────┘        └──────────────────┘
```

### 1.2. Diễn giải luồng dữ liệu

1. **ESP32 → MQTT Broker (chiều lên):** ESP32 đọc cảm biến DHT11 (nhiệt độ, độ ẩm) và LDR (ánh sáng) theo chu kỳ cố định (đề xuất: mỗi 5–10 giây), sau đó `publish` một payload JSON duy nhất lên topic `smarthome/sensor/data`.
2. **Node.js Backend `subscribe` cảm biến:** Backend lắng nghe topic `smarthome/sensor/data`, khi nhận được message sẽ: (a) ghi dữ liệu vào bảng `sensor_data`, (b) lưu giá trị mới nhất vào bộ nhớ đệm (in-memory cache) để phục vụ API "real-time".
3. **Frontend → Backend (điều khiển thiết bị):** Người dùng bấm nút bật/tắt đèn trên Dashboard → Frontend gọi REST API (`PUT /api/devices/:deviceCode/control`) → Backend ghi log vào bảng `action_history`, cập nhật bảng `devices`, đồng thời `publish` lệnh xuống topic `smarthome/device/control`.
4. **MQTT Broker → ESP32 (chiều xuống):** ESP32 `subscribe` topic `smarthome/device/control`, nhận lệnh và điều khiển chân GPIO tương ứng với LED, sau đó `publish` xác nhận trạng thái thực tế lên `smarthome/device/status` để Backend đồng bộ lại (tránh sai lệch trạng thái nếu lệnh điều khiển thất bại).
5. **Backend → Frontend (hiển thị dữ liệu):** Vì giao tiếp Frontend–Backend **chỉ dùng HTTP/REST** (không dùng WebSocket/Socket.IO), tính năng "real-time" trên Dashboard được thực hiện bằng **short-polling**: Frontend gọi lại `GET /api/sensors/latest` theo chu kỳ cố định (đề xuất: mỗi 3–5 giây bằng `setInterval`) để làm mới UI mà không cần reload trang.

> **Quyết định kiến trúc quan trọng (ADR):** Do đã chốt tech stack không dùng WebSocket, "Real-time" trong đồ án này = **Near real-time qua HTTP polling**. Cần ghi rõ điều này trong báo cáo bảo vệ đồ án để giảng viên hiểu đây là lựa chọn có chủ đích, không phải thiếu sót.

### 1.3. Vai trò từng thành phần

| Thành phần | Trách nhiệm chính |
|---|---|
| **ESP32 (Firmware)** | Đọc cảm biến, publish dữ liệu MQTT, subscribe lệnh điều khiển, thực thi bật/tắt LED |
| **MQTT Broker** | Trung gian truyền message giữa ESP32 và Backend (đề xuất dùng Mosquitto hoặc broker cloud miễn phí như HiveMQ) |
| **Node.js Backend** | MQTT client (subscribe/publish), REST API server, xử lý business logic, thao tác MySQL |
| **MySQL Database** | Lưu trữ users, devices, sensors, lịch sử dữ liệu cảm biến và lịch sử hành động |
| **Frontend** | Dashboard hiển thị real-time (polling), trang Lịch sử (có filter + phân trang), trang Profile |

---

## PHẦN 2: DATABASE SCHEMA (MySQL)

### 2.1. Bảng `users`

Lưu tài khoản đăng nhập hệ thống.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | — | |
| `username` | `VARCHAR(50)` | UNIQUE, NOT NULL | — | |
| `password_hash` | `VARCHAR(255)` | NOT NULL | — | Lưu hash (bcrypt), không lưu plain text |
| `full_name` | `VARCHAR(100)` | NULL | — | |
| `email` | `VARCHAR(100)` | UNIQUE, NULL | — | |
| `role` | `ENUM('admin','user')` | NOT NULL | `'user'` | |
| `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | |
| `updated_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` (ON UPDATE `CURRENT_TIMESTAMP`) | |

### 2.2. Bảng `devices`

Lưu danh sách thiết bị điều khiển được (3 đèn LED).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | — | |
| `device_code` | `VARCHAR(50)` | UNIQUE, NOT NULL | — | Mã định danh vật lý, vd `LED_01`. Dùng làm khóa liên lạc với ESP32 qua MQTT |
| `device_name` | `VARCHAR(100)` | NOT NULL | — | Tên hiển thị, vd "Đèn phòng khách" |
| `device_type` | `ENUM('led')` | NOT NULL | `'led'` | Mở rộng thêm loại thiết bị sau này nếu cần |
| `location` | `VARCHAR(100)` | NULL | — | Vị trí lắp đặt |
| `status` | `ENUM('ON','OFF')` | NOT NULL | `'OFF'` | Trạng thái hiện tại (đồng bộ từ topic `smarthome/device/status`) |
| `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | |
| `updated_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` (ON UPDATE `CURRENT_TIMESTAMP`) | |

### 2.3. Bảng `sensors` (Danh mục cảm biến)

Lưu danh mục các cảm biến vật lý được tích hợp trong hệ thống IoT. Việc tách riêng bảng này giúp chuẩn hóa dữ liệu, dễ dàng mở rộng thêm các loại cảm biến mới trong tương lai mà không cần thay đổi cấu trúc bảng lưu trữ chuỗi thời gian.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | — | Mã ID tự tăng nội bộ của cảm biến |
| `sensor_code` | `VARCHAR(50)` | UNIQUE, NOT NULL | — | Mã định danh phần cứng, vd: `TEMP_DHT11`, `HUMI_DHT11`, `LIGHT_LDR` |
| `sensor_name` | `VARCHAR(100)` | NOT NULL | — | Tên hiển thị đầy đủ, vd: "Cảm biến Nhiệt độ DHT11" |
| `sensor_type` | `ENUM('temperature', 'humidity', 'light')` | NOT NULL | — | Phân loại đại lượng vật lý đo lường |
| `unit` | `VARCHAR(20)` | NOT NULL | — | Đơn vị đo hiển thị (`°C`, `%`, `Lux`) |
| `location` | `VARCHAR(100)` | NULL | `'Phòng Khách'` | Vị trí lắp đặt cảm biến trong nhà |
| `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Thời điểm khai báo cảm biến |

### 2.4. Bảng `sensor_data` (Lưu lịch sử đo lường - EAV Pattern)

Lưu chuỗi thời gian (time-series) các giá trị đo được từ các cảm biến. Bảng này liên kết với bảng `sensors` qua khóa ngoại `sensor_id`, phục vụ hiển thị bảng Lịch sử Cảm biến theo chuẩn thiết kế Figma (4 cột: ID định dạng `#001`, Tên cảm biến, Giá trị đo có đơn vị, và Thời gian thu thập).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, AUTO_INCREMENT | — | Mã định danh dòng đo (hiển thị giao diện dạng `#001`, `#002`...) |
| `sensor_id` | `INT UNSIGNED` | FK → `sensors.id`, NOT NULL | — | Khóa ngoại trỏ đến cảm biến thực hiện phép đo |
| `value` | `DECIMAL(10,2)` | NOT NULL | — | Giá trị đo được từ cảm biến |
| `recorded_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Thời điểm thu thập dữ liệu |

**Index tối ưu truy vấn:**
* `INDEX idx_sensor_time (sensor_id, recorded_at)` — tối ưu truy vấn lọc theo loại cảm biến và mốc thời gian.
* `INDEX idx_recorded_at (recorded_at)` — phục vụ sắp xếp giảm dần theo thời gian.
* **FK:** `sensor_id` → `sensors(id)` ON DELETE CASCADE.

### 2.5. Bảng `action_history`

Lưu lịch sử mọi hành động bật/tắt thiết bị chấp hành (Quạt, Đèn).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Ghi chú |
|---|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | PK, AUTO_INCREMENT | — | Mã định danh bản ghi |
| `device_id` | `VARCHAR(50)` | FK → `devices.device_code`, NOT NULL | — | Mã định danh thiết bị vật lý: `LED_01`, `LED_02`, `FAN_01` |
| `user_id` | `INT UNSIGNED` | FK → `users.id`, NULL | — | Người thực hiện (NULL nếu do tự động hóa) |
| `action` | `ENUM('ON','OFF')` | NOT NULL | — | Lệnh gửi đi |
| `status` | `ENUM('ON','OFF','loading')` | NOT NULL | `'ON'` | Trạng thái phản hồi thực tế từ phần cứng |
| `source` | `ENUM('manual','auto')` | NOT NULL | `'manual'` | Nguồn kích hoạt |
| `created_at` | `TIMESTAMP` | NOT NULL | `CURRENT_TIMESTAMP` | Thời điểm gửi lệnh |
| `response_time` | `TIMESTAMP` | NULL | NULL | Thời điểm thiết bị phản hồi xác nhận lệnh |

**Index & Khóa ngoại:**
* `INDEX idx_device_time (device_id, created_at)`
* **FK:** `device_id` → `devices(device_code)` ON DELETE CASCADE; `user_id` → `users(id)` ON DELETE SET NULL.

### 2.6. Sơ đồ quan hệ thực thể (ERD)

```
users (1) ────────< (N) action_history (N) >──────── (1) devices (device_code)

sensors (1) ──────< (N) sensor_data
```

---

## PHẦN 3: MQTT PROTOCOL SPECIFICATION

### 3.1. Quy ước Topic

| Topic | Chiều | QoS đề xuất | Retained | Mô tả |
|---|---|---|---|---|
| `smarthome/sensor/data` | ESP32 **publish** → Backend **subscribe** | 0 | Không | Gửi số liệu cảm biến định kỳ |
| `smarthome/device/control` | Backend **publish** → ESP32 **subscribe** | 1 | Không | Gửi lệnh điều khiển thiết bị |
| `smarthome/device/status` | ESP32 **publish** → Backend **subscribe** | 1 | Không | ESP32 xác nhận trạng thái thực tế sau khi thực thi lệnh |
| `smarthome/device/connection` | ESP32 **publish** (LWT) → Backend **subscribe** | 1 | **Có** | Trạng thái kết nối online/offline của ESP32 (Last Will Testament) |

> Dùng QoS 1 cho các topic liên quan đến điều khiển/trạng thái thiết bị để đảm bảo message không bị mất; QoS 0 đủ dùng cho dữ liệu cảm biến vì có tần suất gửi lặp lại liên tục.

### 3.2. Topic `smarthome/sensor/data`

ESP32 gộp cả 2 giá trị DHT11 và 1 giá trị LDR vào **một payload duy nhất** mỗi chu kỳ gửi, để giảm số lượng message.

**Payload (ESP32 → Backend):**
```json
{
  "temperature": 28.5,
  "humidity": 65.0,
  "lightLevel": 320,
  "timestamp": "2026-08-25T10:30:00Z"
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `temperature` | `number` | Nhiệt độ (°C), từ DHT11 |
| `humidity` | `number` | Độ ẩm (%), từ DHT11 |
| `lightLevel` | `number` | Cường độ ánh sáng (giá trị analog hoặc lux quy đổi), từ LDR |
| `timestamp` | `string` (ISO 8601) | Thời điểm ESP32 đọc cảm biến |

Backend khi nhận message này sẽ tách thành 3 bản ghi tương ứng 3 `sensor_id` (temperature/humidity/light) và insert vào bảng `sensor_data`.

### 3.3. Topic `smarthome/device/control`

Backend gửi lệnh điều khiển xuống ESP32 sau khi người dùng thao tác trên Frontend (hoặc từ rule tự động).

**Payload (Backend → ESP32):**
```json
{
  "deviceCode": "LED_01",
  "action": "ON"
}
```

| Field | Kiểu | Mô tả |
|---|---|---|
| `deviceCode` | `string` | Mã thiết bị, khớp với `devices.device_code`, dùng để ESP32 xác định đúng chân GPIO cần điều khiển |
| `action` | `"ON" \| "OFF"` | Hành động cần thực thi |

### 3.4. Topic `smarthome/device/status`

ESP32 phản hồi lại trạng thái **thực tế** sau khi thực thi lệnh (cơ chế xác nhận hai chiều, tránh mất đồng bộ khi lệnh gửi bị lỗi/nhiễu).

**Payload (ESP32 → Backend):**
```json
{
  "deviceCode": "LED_01",
  "status": "ON",
  "timestamp": "2026-08-25T10:30:05Z"
}
```

Backend nhận message này sẽ `UPDATE devices SET status = ...` — đây là nguồn dữ liệu **duy nhất** được tin cậy để cập nhật cột `status`, không cập nhật trực tiếp ngay khi gửi lệnh control.

### 3.5. Topic `smarthome/device/connection` (Last Will Testament)

Dùng cơ chế LWT chuẩn của MQTT để Backend biết ESP32 có đang online hay không.

**Payload (retained):**
```json
{
  "status": "online"
}
```
Khi ESP32 mất kết nối đột ngột, Broker tự động publish message LWT (`{"status": "offline"}`) thay cho ESP32, giúp Backend/Frontend hiển thị cảnh báo "Thiết bị mất kết nối".

---

## PHẦN 4: RESTful API ENDPOINTS

**Base URL:** `/api`
**Định dạng:** Toàn bộ Request/Response body dùng JSON, field theo `camelCase`.
**Response lỗi chuẩn dùng chung:**
```json
{
  "success": false,
  "message": "Mô tả lỗi"
}
```

### 4.1. Auth

#### `POST /api/auth/login`
Đăng nhập, trả về token.

Request:
```json
{
  "username": "admin",
  "password": "123456"
}
```
Response `200`:
```json
{
  "success": true,
  "data": {
    "token": "jwt-token-string",
    "user": {
      "id": 1,
      "username": "admin",
      "fullName": "Nguyen Van A",
      "role": "admin"
    }
  }
}
```

### 4.2. Devices — Danh sách & Điều khiển thiết bị

#### `GET /api/devices`
Lấy danh sách toàn bộ thiết bị và trạng thái hiện tại (dùng cho Dashboard).

Response `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "deviceCode": "LED_01",
      "deviceName": "Đèn phòng khách",
      "deviceType": "led",
      "location": "Phòng khách",
      "status": "ON",
      "updatedAt": "2026-08-25T10:30:05Z"
    }
  ]
}
```

#### `PUT /api/devices/:deviceCode/control`
Gửi lệnh bật/tắt một thiết bị. Backend sẽ publish MQTT xuống topic `smarthome/device/control` và ghi log vào `action_history`.

Request:
```json
{
  "action": "ON"
}
```
Response `200`:
```json
{
  "success": true,
  "message": "Đã gửi lệnh điều khiển",
  "data": {
    "deviceCode": "LED_01",
    "action": "ON"
  }
}
```
> Lưu ý: Response này chỉ xác nhận **đã gửi lệnh MQTT thành công**, không đồng nghĩa đèn đã bật thực tế. Trạng thái thực tế trong bảng `devices` chỉ cập nhật khi có message xác nhận từ topic `smarthome/device/status` (mục 3.4). Frontend nên polling lại `GET /api/devices` sau vài giây để lấy trạng thái mới nhất.

### 4.3. Sensors — Dữ liệu real-time

#### `GET /api/sensors/latest`
Lấy giá trị mới nhất của 3 cảm biến, phục vụ Dashboard polling.

Response `200`:
```json
{
  "success": true,
  "data": {
    "temperature": 28.5,
    "humidity": 65.0,
    "lightLevel": 320,
    "recordedAt": "2026-08-25T10:30:00Z"
  }
}
```

### 4.4. History — Lịch sử dữ liệu cảm biến (lọc + phân trang + sắp xếp)

#### `GET /api/history/sensors`
Query params:

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `searchBy` | `nhietdo\|doam\|dosang\|thoigian\|all` | Không | Cột cần tìm kiếm |
| `keyword` | `string` | Không | Từ khóa tìm kiếm |
| `sortBy` | `temperature\|humidity\|light\|recorded_at` | Không | Cột cần sắp xếp (mặc định: `id`) |
| `sortOrder` | `ASC\|DESC` | Không | Chiều sắp xếp (mặc định: `DESC`) |
| `page` | `number` | Không (mặc định `1`) | Trang hiện tại |
| `limit` | `number` | Không (mặc định `50`) | Số dòng/trang |

Response `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": 1024,
      "temperature": 31.7,
      "humidity": 79.0,
      "lightLevel": 118.9,
      "recordedAt": "2026-08-25T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 15,
    "totalItems": 300,
    "limit": 50
  }
}
```

### 4.5. History — Lịch sử hành động thiết bị (lọc + phân trang + sắp xếp)

#### `GET /api/history/actions`
Query params:

| Param | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `searchBy` | `thietbi\|trangthai\|thoigian\|all` | Không | Cột cần tìm kiếm |
| `keyword` | `string` | Không | Từ khóa tìm kiếm |
| `sortBy` | `deviceName\|status\|time` | Không | Cột cần sắp xếp (mặc định: `id`) |
| `sortOrder` | `ASC\|DESC` | Không | Chiều sắp xếp (mặc định: `DESC`) |
| `page` | `number` | Không (mặc định `1`) | Trang hiện tại |
| `limit` | `number` | Không (mặc định `20`) | Số dòng/trang |

Response `200`:
```json
{
  "success": true,
  "data": [
    {
      "id": 512,
      "deviceName": "Đèn phòng khách",
      "status": "ON",
      "time": "2026-08-25T10:30:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 90,
    "limit": 20
  }
}
```

### 4.6. Profile

#### `GET /api/profile`
Lấy thông tin tài khoản đang đăng nhập (xác thực qua token).

Response `200`:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "fullName": "Nguyen Van A",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### `PUT /api/profile`
Cập nhật thông tin cá nhân.

Request:
```json
{
  "fullName": "Nguyen Van A",
  "email": "admin@example.com"
}
```
Response `200`:
```json
{
  "success": true,
  "message": "Cập nhật thông tin thành công",
  "data": {
    "id": 1,
    "fullName": "Nguyen Van A",
    "email": "admin@example.com"
  }
}
```

### 4.7. Bảng tổng hợp toàn bộ API

| # | Method | Endpoint | Chức năng |
|---|---|---|---|
| 1 | `POST` | `/api/auth/login` | Đăng nhập |
| 2 | `GET` | `/api/devices` | Danh sách thiết bị + trạng thái |
| 3 | `PUT` | `/api/devices/:deviceCode/control` | Điều khiển bật/tắt thiết bị |
| 4 | `GET` | `/api/sensors/latest` | Dữ liệu cảm biến mới nhất (real-time polling) |
| 5 | `GET` | `/api/history/sensors` | Lịch sử cảm biến (lọc + phân trang) |
| 6 | `GET` | `/api/history/actions` | Lịch sử hành động (lọc + phân trang) |
| 7 | `GET` | `/api/profile` | Xem thông tin cá nhân |
| 8 | `PUT` | `/api/profile` | Cập nhật thông tin cá nhân |

---

## Phụ lục: Checklist đồng bộ khi phát triển

- [ ] Firmware ESP32 dùng đúng tên topic ở mục 3.1, đúng field JSON `camelCase` ở mục 3.2–3.5
- [ ] Backend tạo schema MySQL đúng tên bảng/cột `snake_case` ở Phần 2, có đủ FK + Index đề xuất
- [ ] Backend mapping `snake_case` (DB) ↔ `camelCase` (JSON) tại tầng Model/Service, không để lẫn lộn 2 quy ước ra ngoài API
- [ ] Frontend implement polling `GET /api/sensors/latest` và `GET /api/devices` theo đúng chu kỳ đã thống nhất
- [ ] Mọi thay đổi schema/topic/API phải cập nhật lại tài liệu này trước khi code
