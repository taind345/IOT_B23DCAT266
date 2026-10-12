# Hướng dẫn chạy dự án IoT Smart Home

Chào mọi người, đây là tài liệu hướng dẫn cách chạy dự án Smart Home của mình. Hệ thống này bao gồm Frontend làm giao diện, Backend viết bằng Node.js và lưu dữ liệu bằng MySQL. 

Mọi người làm theo các bước bên dưới để chạy thử nhé.

## Yêu cầu cơ bản
- Máy tính cần cài sẵn Node.js (cứ bản 16 trở lên là được).
- Cài sẵn cơ sở dữ liệu MySQL hoặc MariaDB. Nếu ai dùng Fedora hay Linux nói chung thì cài MariaDB cho tiện nhé.

## Bước 1: Khởi tạo Database
Trước khi chạy code thì mình phải tạo các bảng trong database để backend có chỗ lưu và đọc dữ liệu.

1. Bật MySQL server lên. Ai xài Linux/Fedora thì gõ lệnh bật service lên (ví dụ: `sudo systemctl start mariadb`).
2. Ở thư mục gốc của dự án, mình đã để sẵn file `database.sql`. Mọi người chỉ cần import file này vào MySQL.
   - Cách nhanh nhất qua terminal: `mysql -u root < database.sql`
   - Hoặc nếu ai xài Windows dùng XAMPP thì cứ mở phpMyAdmin lên, copy toàn bộ nội dung trong file đó dán vào tab SQL rồi chạy là xong. Nó sẽ tự tạo database tên là smarthome và đổ data mẫu vào.

## Bước 2: Cài đặt thư viện
1. Mở terminal, chuyển hướng vào thư mục backend:
   `cd backend`
2. Cài đặt các thư viện cần thiết bằng lệnh:
   `npm install`

## Bước 3: Kiểm tra cấu hình kết nối Database
Mặc định mình cấu hình kết nối tới MySQL với user là `root` và không có mật khẩu. 
Nếu MySQL trên máy của bạn có đặt mật khẩu, bạn cần vào file `backend/src/config/database.js` để điền mật khẩu của bạn vào chỗ `password: ''` nhé.

## Bước 4: Chạy Server
Cũng ở trong thư mục `backend`, mọi người gõ lệnh sau để chạy:
`npm start`

Nếu terminal báo "Máy chủ Backend khởi chạy thành công" là hệ thống đã kết nối được với database và sẵn sàng hoạt động.

## Bước 5: Xem giao diện
Mọi người mở trình duyệt web lên và truy cập vào các link sau:

- Trang giao diện chính (Dashboard): `http://localhost:3000` (Mình đã thiết lập để backend tự động phục vụ luôn code html của frontend để đỡ phải chạy 2 server).
- Tài liệu các API (Swagger): `http://localhost:3000/api-docs`

Ghi chú: Khi mới chạy thì biểu đồ có thể chưa có nhiều điểm dữ liệu. Mọi người có thể mở database lên, insert đại vài dòng số liệu vào bảng `sensor_data` rồi xem biểu đồ trên giao diện nó tự cập nhật nhé.
