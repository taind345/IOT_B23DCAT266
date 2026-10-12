#!/bin/bash
echo "Đang cấu hình lại MariaDB và cấp quyền truy cập..."

# Tạo cơ sở dữ liệu smarthome
mysql -u root -e "CREATE DATABASE IF NOT EXISTS smarthome;"

# Tạo user 'iotuser' với mật khẩu 'iot123' cho Node.js sử dụng
mysql -u root -e "CREATE USER IF NOT EXISTS 'iotuser'@'localhost' IDENTIFIED BY 'iot123';"
mysql -u root -e "GRANT ALL PRIVILEGES ON smarthome.* TO 'iotuser'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"

# Import file SQL vào cơ sở dữ liệu
mysql -u root smarthome < database.sql

echo "✅ Đã nạp dữ liệu và cấu hình quyền truy cập thành công!"
