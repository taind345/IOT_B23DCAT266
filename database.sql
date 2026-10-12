CREATE DATABASE IF NOT EXISTS smarthome;
USE smarthome;

-- Xóa bảng cũ nếu đã tồn tại để nạp lại dữ liệu sạch sẽ
DROP TABLE IF EXISTS action_history;
DROP TABLE IF EXISTS sensor_data;
DROP TABLE IF EXISTS sensors;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS users;

-- 1. Bảng users
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    role ENUM('admin','user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Bảng devices (Thiết bị chấp hành: Quạt, Đèn)
CREATE TABLE IF NOT EXISTS devices (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_code VARCHAR(50) NOT NULL UNIQUE,
    device_name VARCHAR(100) NOT NULL,
    device_type ENUM('led', 'fan') NOT NULL DEFAULT 'led',
    location VARCHAR(100),
    status ENUM('ON','OFF') NOT NULL DEFAULT 'OFF',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Bảng sensors (Quản lý danh mục các cảm biến trong hệ thống)
CREATE TABLE IF NOT EXISTS sensors (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sensor_code VARCHAR(50) NOT NULL UNIQUE,
    sensor_name VARCHAR(100) NOT NULL,
    sensor_type ENUM('temperature', 'humidity', 'light') NOT NULL,
    unit VARCHAR(20) NOT NULL,
    location VARCHAR(100) DEFAULT 'Phòng Khách',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Bảng sensor_data (Lưu lịch sử từng điểm đo của các cảm biến theo chuẩn EAV)
CREATE TABLE IF NOT EXISTS sensor_data (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sensor_id INT UNSIGNED NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sensor_time (sensor_id, recorded_at),
    INDEX idx_recorded_at (recorded_at),
    FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE
);

-- 5. Bảng action_history (device_id lưu trực tiếp mã định danh phần cứng: LED_01, LED_02, FAN_01)
CREATE TABLE IF NOT EXISTS action_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    user_id INT UNSIGNED,
    action ENUM('ON','OFF') NOT NULL,
    status ENUM('ON','OFF','loading') NOT NULL DEFAULT 'ON',
    source ENUM('manual','auto') NOT NULL DEFAULT 'manual',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response_time TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_device_time (device_id, created_at),
    FOREIGN KEY (device_id) REFERENCES devices(device_code) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ==========================================
-- Dữ liệu mẫu (Seed data) mặc định - Mốc tháng 09/2026
-- ==========================================

-- Thêm thiết bị chấp hành mẫu
INSERT INTO devices (id, device_code, device_name, device_type, location, status) VALUES
(1, 'LED_01', 'Đèn 1 (Phòng Khách)', 'led', 'Phòng Khách', 'OFF'),
(2, 'LED_02', 'Đèn 2 (Phòng Ngủ)', 'led', 'Phòng Ngủ', 'OFF'),
(3, 'FAN_01', 'Quạt (Phòng Khách)', 'fan', 'Phòng Khách', 'OFF');

-- Thêm tài khoản admin (password: 123456)
INSERT INTO users (id, username, password_hash, full_name, email, role, created_at) VALUES
(1, 'admin', '$2b$10$3sKMsYOh2txXEW6b6VkuZujFBtyzjVJrzJB8rbzwLhJKr89DDOvgS', 'Nguyễn Đức Tài', 'admin@example.com', 'admin', '2026-08-01 08:00:00');

-- Thêm danh mục 3 cảm biến
INSERT INTO sensors (id, sensor_code, sensor_name, sensor_type, unit) VALUES
(1, 'TEMP_DHT11', 'Cảm biến Nhiệt độ DHT11', 'temperature', '°C'),
(2, 'HUMI_DHT11', 'Cảm biến Độ ẩm DHT11', 'humidity', '%'),
(3, 'LIGHT_LDR', 'Cảm biến Ánh sáng LDR 4-pin', 'light', 'Lux');

-- Thêm 36 bản ghi dữ liệu cảm biến (Khớp chính xác với hình mẫu thiết kế Figma)
INSERT INTO sensor_data (id, sensor_id, value, recorded_at) VALUES 
(1, 1, 27.6, '2026-09-03 01:00:00'),
(2, 2, 63.3, '2026-09-03 01:12:00'),
(3, 3, 491.0, '2026-09-03 01:24:00'),
(4, 1, 27.4, '2026-09-03 01:36:00'),
(5, 2, 70.8, '2026-09-03 01:48:00'),
(6, 3, 502.0, '2026-09-03 02:00:00'),
(7, 1, 26.6, '2026-09-03 02:12:00'),
(8, 2, 66.9, '2026-09-03 02:24:00'),
(9, 3, 480.0, '2026-09-03 02:36:00'),
(10, 1, 28.1, '2026-09-03 02:48:00'),
(11, 2, 68.4, '2026-09-03 03:00:00'),
(12, 3, 515.0, '2026-09-03 03:12:00'),
(13, 1, 28.5, '2026-09-03 03:24:00'),
(14, 2, 69.2, '2026-09-03 03:36:00'),
(15, 3, 530.0, '2026-09-03 03:48:00'),
(16, 1, 29.0, '2026-09-03 04:00:00'),
(17, 2, 71.0, '2026-09-03 04:12:00'),
(18, 3, 545.0, '2026-09-03 04:24:00'),
(19, 1, 29.4, '2026-09-03 04:36:00'),
(20, 2, 72.5, '2026-09-03 04:48:00'),
(21, 3, 560.0, '2026-09-03 05:00:00'),
(22, 1, 30.1, '2026-09-03 05:12:00'),
(23, 2, 74.0, '2026-09-03 05:24:00'),
(24, 3, 580.0, '2026-09-03 05:36:00'),
(25, 1, 30.8, '2026-09-03 05:48:00'),
(26, 2, 75.3, '2026-09-03 06:00:00'),
(27, 3, 610.0, '2026-09-03 06:12:00'),
(28, 1, 31.2, '2026-09-03 06:24:00'),
(29, 2, 76.0, '2026-09-03 06:36:00'),
(30, 3, 635.0, '2026-09-03 06:48:00'),
(31, 1, 31.7, '2026-09-03 07:00:00'),
(32, 2, 75.0, '2026-09-03 07:12:00'),
(33, 3, 650.0, '2026-09-03 07:24:00'),
(34, 1, 32.0, '2026-09-03 07:36:00'),
(35, 2, 73.8, '2026-09-03 07:48:00'),
(36, 3, 670.0, '2026-09-03 08:00:00');

-- Thêm 28 bản ghi lịch sử thao tác để phân trang đẹp mắt (4 trang x 8 dòng/trang)
INSERT INTO action_history (device_id, user_id, action, status, source, created_at, response_time) VALUES
('FAN_01', 1, 'ON', 'ON', 'manual', '2026-09-03 01:15:20', '2026-09-03 01:15:21'),
('LED_01', 1, 'ON', 'ON', 'manual', '2026-09-03 01:30:05', '2026-09-03 01:30:06'),
('LED_02', 1, 'ON', 'ON', 'manual', '2026-09-03 02:00:12', '2026-09-03 02:00:13'),
('LED_02', 1, 'OFF', 'OFF', 'manual', '2026-09-03 02:45:30', '2026-09-03 02:45:31'),
('FAN_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 03:10:15', '2026-09-03 03:10:16'),
('LED_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 03:30:40', '2026-09-03 03:30:41'),
('FAN_01', 1, 'ON', 'ON', 'manual', '2026-09-03 03:45:02', '2026-09-03 03:45:03'),
('LED_01', 1, 'ON', 'ON', 'manual', '2026-09-03 04:00:00', '2026-09-03 04:00:01'),
('LED_02', 1, 'ON', 'ON', 'manual', '2026-09-03 04:20:10', '2026-09-03 04:20:11'),
('FAN_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 04:40:00', '2026-09-03 04:40:01'),
('LED_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 05:00:00', '2026-09-03 05:00:01'),
('LED_02', 1, 'OFF', 'OFF', 'manual', '2026-09-03 05:15:30', '2026-09-03 05:15:31'),
('FAN_01', 1, 'ON', 'ON', 'manual', '2026-09-03 05:30:00', '2026-09-03 05:30:01'),
('LED_01', 1, 'ON', 'ON', 'manual', '2026-09-03 05:45:00', '2026-09-03 05:45:01'),
('LED_02', 1, 'ON', 'ON', 'manual', '2026-09-03 06:00:00', '2026-09-03 06:00:01'),
('FAN_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 06:15:00', '2026-09-03 06:15:01'),
('LED_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 06:30:00', '2026-09-03 06:30:01'),
('LED_02', 1, 'OFF', 'OFF', 'manual', '2026-09-03 06:45:00', '2026-09-03 06:45:01'),
('FAN_01', 1, 'ON', 'ON', 'manual', '2026-09-03 07:00:00', '2026-09-03 07:00:01'),
('LED_01', 1, 'ON', 'ON', 'manual', '2026-09-03 07:15:00', '2026-09-03 07:15:01'),
('LED_02', 1, 'ON', 'ON', 'manual', '2026-09-03 07:30:00', '2026-09-03 07:30:01'),
('FAN_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 07:45:00', '2026-09-03 07:45:01'),
('LED_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 08:00:00', '2026-09-03 08:00:01'),
('LED_02', 1, 'OFF', 'OFF', 'manual', '2026-09-03 08:15:00', '2026-09-03 08:15:01'),
('FAN_01', 1, 'ON', 'ON', 'manual', '2026-09-03 08:30:00', '2026-09-03 08:30:01'),
('LED_01', 1, 'ON', 'ON', 'manual', '2026-09-03 08:45:00', '2026-09-03 08:45:01'),
('LED_02', 1, 'ON', 'ON', 'manual', '2026-09-03 09:00:00', '2026-09-03 09:00:01'),
('FAN_01', 1, 'OFF', 'OFF', 'manual', '2026-09-03 09:15:00', '2026-09-03 09:15:01');
