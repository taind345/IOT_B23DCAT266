# HƯỚNG DẪN BÀI 2 (RÚT GỌN)
Xem file đầy đủ tại: [README_BAI_2.md](../README_BAI_2.md)

### 3 Terminal chính:
- **Terminal 1 (Data Sensor):**
  `.\mosquitto_sub -h localhost -p 1883 -u tainguyen -P tainguyen -t "data/sensor" -v`
- **Terminal 3 (Device Response):**
  `.\mosquitto_sub -h localhost -p 1883 -u tainguyen -P tainguyen -t "device/response" -v`
- **Terminal 2 (Device Control):**
  - **Bật cả 2 đèn:**
    `.\mosquitto_pub -h localhost -p 1883 -u tainguyen -P tainguyen -t "device/control/all" -m '{\"led1\":\"ON\",\"led2\":\"ON\"}'`
  - **Tắt cả 2 đèn:**
    `.\mosquitto_pub -h localhost -p 1883 -u tainguyen -P tainguyen -t "device/control/all" -m '{\"led1\":\"OFF\",\"led2\":\"OFF\"}'`
  - **Bật Đèn 1, Tắt Đèn 2:**
    `.\mosquitto_pub -h localhost -p 1883 -u tainguyen -P tainguyen -t "device/control/all" -m '{\"led1\":\"ON\",\"led2\":\"OFF\"}'`
  - **Tắt Đèn 1, Bật Đèn 2:**
    `.\mosquitto_pub -h localhost -p 1883 -u tainguyen -P tainguyen -t "device/control/all" -m '{\"led1\":\"OFF\",\"led2\":\"ON\"}'`
  - **Điều khiển riêng lẻ:**
    `.\mosquitto_pub -h localhost -p 1883 -u tainguyen -P tainguyen -t "device/control/led1" -m "ON"`
    `.\mosquitto_pub -h localhost -p 1883 -u tainguyen -P tainguyen -t "device/control/led2" -m "ON"`
