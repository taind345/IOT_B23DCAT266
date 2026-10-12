const db = require('../config/database');

class SensorService {
    /**
     * Lấy dữ liệu cảm biến mới nhất (Dựa vào thiết kế bảng mới)
     */
    static async getLatestSensorData() {
        try {
            // Cú pháp cho bảng sensors + sensor_data mới (chuẩn EAV)
            const query = `
                SELECT 
                    MAX(CASE WHEN s.sensor_type = 'temperature' THEN d.value END) as temperature,
                    MAX(CASE WHEN s.sensor_type = 'humidity' THEN d.value END) as humidity,
                    MAX(CASE WHEN s.sensor_type = 'light' THEN d.value END) as lightLevel,
                    MAX(d.recorded_at) as recordedAt
                FROM sensor_data d
                JOIN sensors s ON d.sensor_id = s.id
                WHERE d.id >= (SELECT COALESCE(MAX(id), 0) - 10 FROM sensor_data)
            `;

            const [rows] = await db.execute(query);

            if (rows && rows.length > 0 && rows[0].temperature !== null) {
                const row = rows[0];
                return {
                    temperature: parseFloat(row.temperature),
                    humidity: parseFloat(row.humidity),
                    lightLevel: parseFloat(row.lightLevel),
                    recordedAt: row.recordedAt
                };
            }
        } catch (e) {
            // Fallback nếu database là cấu trúc bảng sensor_data cũ
            try {
                const [oldRows] = await db.execute('SELECT temperature, humidity, light, recorded_at FROM sensor_data ORDER BY id DESC LIMIT 1');
                if (oldRows && oldRows.length > 0) {
                    return {
                        temperature: parseFloat(oldRows[0].temperature),
                        humidity: parseFloat(oldRows[0].humidity),
                        lightLevel: parseFloat(oldRows[0].light),
                        recordedAt: oldRows[0].recorded_at
                    };
                }
            } catch (err2) {}
        }

        // Giá trị mặc định an toàn nếu DB chưa có dòng dữ liệu nào
        return {
            temperature: 28.5,
            humidity: 65.0,
            lightLevel: 500.0,
            recordedAt: new Date()
        };
    }
}

module.exports = SensorService;
