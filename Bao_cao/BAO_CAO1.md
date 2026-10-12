# BÁO CÁO TIẾN ĐỘ
**BÀI 1: THIẾT KẾ HỆ THỐNG VÀ CƠ SỞ DỮ LIỆU**

---

## MỤC TIÊU
Xây dựng tài liệu đặc tả, bản vẽ kiến trúc và thiết kế nền tảng dữ liệu cho toàn bộ hệ thống IoT Smart Home. Bài báo cáo này trình bày chi tiết về quy trình phân tích yêu cầu (Use Case), thiết kế giao diện (UI/UX), cấu trúc cơ sở dữ liệu (Database Schema), luồng hoạt động (Sequence Diagram) và đặc tả giao tiếp (API Documentation).

---

## 1. MÔ TẢ USE CASE (CA SỬ DỤNG)

Hệ thống được phân tích và thiết kế với 6 Use Case cốt lõi nhằm đáp ứng đầy đủ nhu cầu giám sát và điều khiển nhà thông minh.

| Mã UC | Tên Use Case | Tác nhân (Actor) | Mô tả nghiệp vụ |
|---|---|---|---|
| **UC1** | Đăng nhập hệ thống | User, Admin | Nhập username và password để xác thực và nhận JWT Token truy cập hệ thống. |
| **UC2** | Giám sát môi trường | User, Admin | Theo dõi các thông số môi trường (Nhiệt độ, Độ ẩm, Ánh sáng) trên Dashboard với dữ liệu cập nhật liên tục (Near real-time). |
| **UC3** | Điều khiển thiết bị | User, Admin | Bật/tắt các thiết bị ngoại vi (Đèn, Quạt) thông qua các công tắc điều khiển trên giao diện UI. |
| **UC4** | Xem lịch sử dữ liệu cảm biến | User, Admin | Tra cứu sự biến thiên của các thông số môi trường trong quá khứ, hỗ trợ phân trang, tìm kiếm và sắp xếp. |
| **UC5** | Xem lịch sử hoạt động thiết bị | User, Admin | Kiểm tra lại lịch sử bật/tắt thiết bị (Ai thao tác? Thời gian nào? Bật bằng tay hay tự động?). |
| **UC6** | Quản lý hồ sơ cá nhân | User, Admin | Xem và cập nhật các thông tin cá nhân (Họ tên, Email liên hệ). |

> **[CHỖ TRỐNG - CHÈN ẢNH 1]**: *Hãy chèn hình ảnh Biểu đồ Use Case Diagram tổng quát của hệ thống (vẽ bằng Draw.io hoặc StarUML) vào đây.*
> ![Biểu đồ Use Case]()

```mermaid
flowchart LR
    %% Định nghĩa các tác nhân (Actors)
    User(("Người dùng (User)"))
    Admin(("Quản trị viên (Admin)"))
    ESP32(("Thiết bị IoT (ESP32)"))

    %% Quan hệ kế thừa: Admin kế thừa mọi quyền của User
    Admin -.->|Kế thừa| User

    %% Ranh giới của hệ thống (System Boundary)
    subgraph System ["HỆ THỐNG SMART HOME IOT"]
        direction TB
        UC1(["UC1: Đăng nhập hệ thống"])
        UC2(["UC2: Giám sát môi trường"])
        UC3(["UC3: Điều khiển thiết bị (Bật/Tắt)"])
        UC4(["UC4: Xem lịch sử dữ liệu cảm biến"])
        UC5(["UC5: Xem lịch sử hoạt động thiết bị"])
        UC6(["UC6: Quản lý hồ sơ cá nhân"])
        Auth(["Xác thực danh tính (Auth)"])
        
        UC_Sys_1(["Ghi nhận thông số môi trường"])
        UC_Sys_2(["Cập nhật trạng thái phần cứng"])
    end

    %% Liên kết Actor -> Use Case
    User --- UC1
    User --- UC2
    User --- UC3
    User --- UC4
    User --- UC5
    User --- UC6

    ESP32 ---|"Publish dữ liệu"| UC_Sys_1
    ESP32 ---|"Phản hồi trạng thái"| UC_Sys_2

    %% Quan hệ Include / Extend giữa các Use Case
    UC1 -.->|<<include>>| Auth
    UC2 -.->|<<include>>| Auth
    UC3 -.->|<<include>>| Auth
    UC4 -.->|<<include>>| Auth
    UC5 -.->|<<include>>| Auth
    UC6 -.->|<<include>>| Auth

    UC_Sys_1 -.->|<<extend>>| UC2
    UC3 -.->|<<include>>| UC_Sys_2

    %% Style giao diện biểu đồ
    classDef actor fill:#ffffff,stroke:#333,stroke-width:2px,color:#000
    classDef usecase fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,color:#000
    classDef system fill:#f8f9fa,stroke:#ccc,stroke-width:2px,stroke-dasharray: 5 5
    
    class User,Admin,ESP32 actor
    class UC1,UC2,UC3,UC4,UC5,UC6,Auth,UC_Sys_1,UC_Sys_2 usecase
    class System system
```

---

## 2. THIẾT KẾ UI/UX

Giao diện Frontend được thiết kế theo hướng tối giản, hiện đại (Minimalist & Modern), đảm bảo tính tương tác cao. Toàn bộ hệ thống áp dụng phong cách thiết kế **Vintage / Retro** (sử dụng phông chữ máy đánh chữ cổ điển, màu nền sepia). Bản vẽ thiết kế (Mockup/Prototype) được thực hiện trên nền tảng **Figma** ([Xem bản vẽ Figma Prototype](https://www.figma.com/design/Rvp8ZF9YWmAVHasuFuoUUV/HTML-to-Figma--Community-?node-id=0-1&t=7ZkeueLaBrYHYakL-1)) với các màn hình chính:

* **Màn hình Đăng nhập (Login Screen - UC1):** Màn hình xác thực danh tính phong cách Retro cổ điển, cho phép User/Admin đăng nhập vào hệ thống an toàn qua JWT Token.
* **Dashboard & Menu (Trang chủ - UC2, UC3):** Thiết kế dạng Single Page Application (SPA) đa Tab với thanh Navbar điều hướng mượt mà, hiển thị thông tin User đang đăng nhập và nút Đăng xuất.
  - Bố cục chia 2 phần: Trái (thẻ thông số cảm biến và Biểu đồ Chart.js thời gian thực), Phải (Công tắc Toggle điều khiển thiết bị).
* **Trang Data Sensor (UC4):** Thiết kế dạng Data Table 5 cột (ID, Nhiệt độ, Độ ẩm, Độ sáng, Thời gian). Tích hợp thanh công cụ (Toolbar) hỗ trợ tìm kiếm theo từng cột hoặc tất cả, sắp xếp (Sort Tăng/Giảm) và phân trang 50 bản ghi/trang.
* **Trang Active History (UC5):** Bảng lịch sử bật/tắt gồm 4 cột (ID, Thiết bị, Trạng thái, Thời gian), có thanh công cụ tìm kiếm, sắp xếp và phân trang 20 bản ghi/trang.
* **Trang Hồ sơ cá nhân (Profile - UC6):** Giao diện xem thông tin tài khoản (Username, Role) và form cập nhật Họ tên, Email liên hệ.

> **[CHỖ TRỐNG - CHÈN ẢNH 2.1]**: *Hãy chèn hình ảnh Màn hình Đăng nhập (Login) vào đây.*
> ![Giao diện Đăng nhập]()

> **[CHỖ TRỐNG - CHÈN ẢNH 2.2]**: *Hãy chèn hình ảnh thiết kế UI trang Dashboard vào đây.*
> ![Giao diện Dashboard]()

> **[CHỖ TRỐNG - CHÈN ẢNH 2.3]**: *Hãy chèn hình ảnh thiết kế UI trang Lịch sử & Dữ liệu cảm biến vào đây.*
> ![Giao diện Lịch sử]()

> **[CHỖ TRỐNG - CHÈN ẢNH 2.4]**: *Hãy chèn hình ảnh thiết kế UI trang Hồ sơ cá nhân (Profile) vào đây.*
> ![Giao diện Profile]()

---

## 3. THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE DESIGN)

Hệ quản trị CSDL được lựa chọn là **MySQL** với chuẩn thiết kế tên bảng/cột là `snake_case`. Lược đồ (Schema) bao gồm 4 bảng chính, có tính toàn vẹn dữ liệu cao (ràng buộc Khóa ngoại - Foreign Key rõ ràng).

1. **Bảng `users`**: Lưu trữ tài khoản đăng nhập (Phân quyền Role: admin/user, Password mã hóa Bcrypt).
2. **Bảng `devices`**: Danh mục các thiết bị vật lý có thể điều khiển (Mã thiết bị, Tên, Trạng thái ON/OFF thực tế).
3. **Bảng `sensor_data`**: Bảng dữ liệu chuỗi thời gian (Time-series data) lưu lịch sử các chỉ số môi trường. Bảng được thiết kế phẳng (Flattened Schema) với các cột `temperature`, `humidity`, `light` trên cùng một hàng để phục vụ truy vấn tối ưu cho giao diện bảng 5 cột. Áp dụng Index trên trường thời gian.
4. **Bảng `action_history`**: Ghi log mọi hành động điều khiển (Bật/Tắt) của người dùng hoặc hệ thống, có liên kết với bảng `users` và `devices`.

```mermaid
erDiagram
    users {
        int id PK "UNSIGNED, AUTO_INCREMENT"
        varchar username UK "50"
        varchar password_hash "255"
        varchar full_name "100"
        varchar email UK "100"
        enum role "admin, user"
        timestamp created_at
        timestamp updated_at
    }

    devices {
        int id PK "UNSIGNED, AUTO_INCREMENT"
        varchar device_code UK "50"
        varchar device_name "100"
        enum device_type "led, fan"
        varchar location "100"
        enum status "ON, OFF"
        timestamp created_at
        timestamp updated_at
    }

    sensor_data {
        bigint id PK "UNSIGNED, AUTO_INCREMENT"
        decimal temperature "10,2"
        decimal humidity "10,2"
        decimal light "10,2"
        timestamp recorded_at
    }

    action_history {
        bigint id PK "UNSIGNED, AUTO_INCREMENT"
        int device_id FK "REFERENCES devices(id)"
        int user_id FK "REFERENCES users(id)"
        enum action "ON, OFF"
        enum source "manual, auto"
        timestamp created_at
    }

    devices ||--o{ action_history : "has"
    users ||--o{ action_history : "executes"
```

> **[CHỖ TRỐNG - CHÈN ẢNH 4]**: *Hãy chèn hình ảnh Sơ đồ Thực thể Liên kết (ERD - Entity Relationship Diagram) hoặc ảnh chụp từ chức năng Reverse Engineer của MySQL Workbench vào đây.*
> ![Sơ đồ CSDL ERD]()

---

## 4. THIẾT KẾ LUỒNG HOẠT ĐỘNG (SEQUENCE DIAGRAM)

Theo yêu cầu nghiệp vụ, hệ thống bao gồm 6 biểu đồ tuần tự (Sequence Diagram) tương ứng với 6 Use Case cốt lõi nhằm làm rõ quá trình giao tiếp giữa các thành phần (Frontend, Backend, Database, MQTT, và Hardware).

### 4.1. UC1: Đăng nhập hệ thống
Mô tả luồng xác thực danh tính người dùng và cấp phát Token.

```mermaid
sequenceDiagram
    participant UI as UI (Frontend)
    participant API as Backend (Node.js)
    participant DB as MySQL Database

    UI->>API: 1. POST /api/auth/login (username, password)
    API->>DB: 2. Query tìm user theo username
    DB-->>API: 3. Trả về user & password_hash
    API->>API: 4. So sánh mật khẩu bằng Bcrypt
    API->>API: 5. Tạo JWT Token
    API-->>UI: 6. Trả về JSON { token, user_info }
    UI->>UI: 7. Lưu Token vào LocalStorage & Chuyển hướng
```
> **[CHỖ TRỐNG - CHÈN ẢNH 5.1]**: *Chèn ảnh Sequence Diagram UC1 vào đây.*
> ![Sequence Diagram UC1]()

### 4.2. UC2: Giám sát môi trường thời gian thực
Mô tả luồng dữ liệu liên tục từ cảm biến lên Server và Frontend liên tục lấy về để vẽ biểu đồ.

```mermaid
sequenceDiagram
    participant HW as Hardware (ESP32)
    participant MQTT as MQTT Broker
    participant API as Backend (Node.js)
    participant DB as MySQL Database
    participant UI as UI (Frontend)

    loop Mỗi 5-10 giây (Uplink)
        HW->>MQTT: 1. Publish dữ liệu (smarthome/sensor/data)
        MQTT->>API: 2. Backend Subscribe nhận data
        API->>DB: 3. Insert dữ liệu vào bảng sensor_data
    end
    
    loop Mỗi 3 giây (Polling)
        UI->>API: 4. GET /api/v1/sensors/data/latest
        API->>DB: 5. Query lấy dữ liệu mới nhất (MAX id)
        DB-->>API: 6. Kết quả dữ liệu
        API-->>UI: 7. JSON data
        UI->>UI: 8. Cập nhật DOM & vẽ lại Chart.js
    end
```
> **[CHỖ TRỐNG - CHÈN ẢNH 5.2]**: *Chèn ảnh Sequence Diagram UC2 vào đây.*
> ![Sequence Diagram UC2]()

### 4.3. UC3: Điều khiển thiết bị
Mô tả luồng người dùng bật/tắt thiết bị, ghi log và đồng bộ với phần cứng vật lý.

```mermaid
sequenceDiagram
    participant UI as UI (Frontend)
    participant API as Backend (Node.js)
    participant DB as MySQL Database
    participant MQTT as MQTT Broker
    participant HW as Hardware (ESP32)

    UI->>API: 1. Click Toggle (POST /api/v1/devices/toggle)
    API->>DB: 2. Lưu log điều khiển vào action_history
    API->>MQTT: 3. Publish lệnh (smarthome/device/control)
    API-->>UI: 4. HTTP 200 OK (Xác nhận đã gửi lệnh)
    MQTT->>HW: 5. Forward lệnh tới ESP32
    HW->>HW: 6. Kích hoạt GPIO (Bật/tắt Relay/LED)
    HW->>MQTT: 7. Publish trạng thái thực (smarthome/device/status)
    MQTT->>API: 8. Backend nhận status cập nhật
    API->>DB: 9. Update trạng thái ON/OFF vào bảng devices
```
> **[CHỖ TRỐNG - CHÈN ẢNH 5.3]**: *Chèn ảnh Sequence Diagram UC3 vào đây.*
> ![Sequence Diagram UC3]()

### 4.4. UC4: Xem lịch sử dữ liệu cảm biến
Mô tả quá trình tra cứu, lọc và phân trang dữ liệu cảm biến quá khứ.

```mermaid
sequenceDiagram
    participant UI as UI (Frontend)
    participant API as Backend (Node.js)
    participant DB as MySQL Database

    UI->>UI: 1. Nhập tìm kiếm, click Sắp xếp (Sort) cột
    UI->>API: 2. GET /api/history/sensors?searchBy=...&keyword=...&sortBy=...&page=...
    API->>DB: 3. Query SELECT ... WHERE ... LIKE ... ORDER BY ... LIMIT 50
    DB-->>API: 4. Trả về mảng dữ liệu (5 cột) & Tổng số bản ghi (Total count)
    API-->>UI: 5. JSON { data, pagination }
    UI->>UI: 6. Render Bảng dữ liệu Vintage & Phân trang
```
> **[CHỖ TRỐNG - CHÈN ẢNH 5.4]**: *Chèn ảnh Sequence Diagram UC4 vào đây.*
> ![Sequence Diagram UC4]()

### 4.5. UC5: Xem lịch sử hoạt động thiết bị
Mô tả quá trình tra cứu, tìm kiếm và sắp xếp lịch sử các lần bật/tắt thiết bị của các tài khoản.

```mermaid
sequenceDiagram
    participant UI as UI (Frontend)
    participant API as Backend (Node.js)
    participant DB as MySQL Database

    UI->>UI: 1. Nhập từ khóa tìm kiếm (Tên TB, Trạng thái...)
    UI->>API: 2. GET /api/history/actions?searchBy=...&keyword=...&sortBy=...&page=...
    API->>DB: 3. Query action_history JOIN devices kèm WHERE ... LIKE ...
    DB-->>API: 4. Trả về kết quả lịch sử
    API-->>UI: 5. JSON { data, pagination }
    UI->>UI: 6. Cập nhật bảng dữ liệu trên giao diện
```
> **[CHỖ TRỐNG - CHÈN ẢNH 5.5]**: *Chèn ảnh Sequence Diagram UC5 vào đây.*
> ![Sequence Diagram UC5]()

### 4.6. UC6: Quản lý hồ sơ cá nhân
Mô tả luồng cập nhật thông tin User Profile.

```mermaid
sequenceDiagram
    participant UI as UI (Frontend)
    participant API as Backend (Node.js)
    participant DB as MySQL Database

    UI->>API: 1. PUT /api/profile {fullName, email} + JWT Token
    API->>API: 2. Validate Token & Lấy userId
    API->>DB: 3. UPDATE users SET ... WHERE id = userId
    DB-->>API: 4. Xác nhận lưu thành công
    API-->>UI: 5. JSON { success, updatedUser }
    UI->>UI: 6. Hiển thị thông báo (Toast/Alert) thành công
```
> **[CHỖ TRỐNG - CHÈN ẢNH 5.6]**: *Chèn ảnh Sequence Diagram UC6 vào đây.*
> ![Sequence Diagram UC6]()

---

## 5. TÀI LIỆU HÓA API (API DOCUMENTATION)

Toàn bộ Backend API được đặc tả theo chuẩn **OpenAPI 3.0 (Swagger)**. Việc này đảm bảo tính thống nhất (Single Source of Truth) giữa Frontend và Backend. Cấu trúc Response áp dụng quy ước `camelCase`, trong khi Database dùng `snake_case`, Backend đóng vai trò mapping ở giữa.

**Các Endpoint chính đã được thiết kế và triển khai:**
1. `POST /api/auth/login`: Xác thực danh tính và cấp phát JWT Token (UC1).
2. `GET /api/v1/sensors/data/latest`: Lấy thông số cảm biến thời gian thực cho Dashboard & Chart (UC2).
3. `POST /api/v1/devices/toggle`: Gửi lệnh điều khiển bật/tắt thiết bị ngoại vi (UC3).
4. `GET /api/history/sensors`: Trích xuất lịch sử thông số cảm biến có phân trang, tìm kiếm và sắp xếp (UC4).
5. `GET /api/history/actions`: Trích xuất lịch sử bật/tắt thiết bị có phân trang và tìm kiếm (UC5).
6. `GET /api/profile` & `PUT /api/profile`: Xem và cập nhật thông tin hồ sơ người dùng (UC6).

> **[CHỖ TRỐNG - CHÈN ẢNH 6.1]**: *Hãy mở Swagger UI tại `http://localhost:3000/api-docs` và chụp ảnh màn hình danh sách các API dán vào đây.*
> ![Ảnh Swagger UI]()

> **[CHỖ TRỐNG - CHÈN ẢNH 6.2]**: *Chụp chi tiết phần Response body của 1 API quan trọng (VD: API lấy Sensor data sau khi bấm Execute) để minh chứng JSON đúng chuẩn.*
> ![Ảnh Chi tiết API]()
