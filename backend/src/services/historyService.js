const db = require('../config/database');

class HistoryService {
    /**
     * Lấy dữ liệu cảm biến (Pagination, Search, Sort) khớp mẫu Figma:
     * id (#001), sensorName (Cảm biến Nhiệt độ DHT11), value (27.6), unit (°C), recordedAt
     */
    static async getSensorHistory(page = 1, limit = 8, sensorType, keywordValue, keywordTime, sortBy = 'id', sortOrder = 'ASC') {
        const offset = (page - 1) * limit;
        let query = `
            SELECT 
                d.id, 
                s.sensor_name as sensorName, 
                s.sensor_type as sensorType, 
                s.unit, 
                d.value, 
                d.recorded_at as recordedAt 
            FROM sensor_data d
            JOIN sensors s ON d.sensor_id = s.id
        `;
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM sensor_data d
            JOIN sensors s ON d.sensor_id = s.id
        `;
        const conditions = [];
        const params = [];

        // 1. Lọc theo Loại cảm biến
        if (sensorType && sensorType !== 'all' && sensorType !== 'Tất cả cảm biến') {
            conditions.push(`(s.sensor_type = ? OR s.sensor_name LIKE ?)`);
            params.push(sensorType, `%${sensorType}%`);
        }

        // 2. Lọc theo Giá trị (hỗ trợ so sánh >30, <25 hoặc tìm kiếm số tương đối)
        if (keywordValue && keywordValue.trim()) {
            const valStr = keywordValue.trim();
            if (valStr.startsWith('>')) {
                const num = parseFloat(valStr.substring(1));
                if (!isNaN(num)) {
                    conditions.push(`d.value > ?`);
                    params.push(num);
                }
            } else if (valStr.startsWith('<')) {
                const num = parseFloat(valStr.substring(1));
                if (!isNaN(num)) {
                    conditions.push(`d.value < ?`);
                    params.push(num);
                }
            } else {
                conditions.push(`d.value LIKE ?`);
                params.push(`%${valStr}%`);
            }
        }

        // 3. Lọc theo Thời gian (hỗ trợ dd/mm/yyyy hoặc hh:mm)
        if (keywordTime && keywordTime.trim()) {
            const tStr = keywordTime.trim();
            conditions.push(`DATE_FORMAT(d.recorded_at, '%d/%m/%Y %H:%i') LIKE ?`);
            params.push(`%${tStr}%`);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        const validSortColumns = ['id', 'sensorName', 'value', 'recordedAt'];
        const dbSortCol = {
            'id': 'd.id',
            'sensorName': 's.sensor_name',
            'value': 'd.value',
            'recordedAt': 'd.recorded_at'
        }[sortBy] || 'd.id';

        const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        query += ` ORDER BY ${dbSortCol} ${order} LIMIT ? OFFSET ?`;

        const queryParams = [...params, limit, offset];
        const [rows] = await db.execute(query, queryParams.map(p => typeof p === 'string' ? p : Number(p)));
        const [countRows] = await db.execute(countQuery, params);

        return {
            data: rows.map(r => ({
                id: r.id,
                displayId: '#' + String(r.id).padStart(3, '0'),
                sensorName: r.sensorName,
                sensorType: r.sensorType,
                value: parseFloat(r.value),
                unit: r.unit,
                formattedValue: `${r.value} ${r.unit}`,
                recordedAt: r.recordedAt
            })),
            total: countRows[0].total
        };
    }

    /**
     * Lấy dữ liệu hành động (Pagination, Search, Sort) theo chuẩn mới:
     * id, deviceId (FAN_01, LED_01), deviceName, action, status, time, responseTime
     */
    static async getActionHistory(page = 1, limit = 20, searchBy, keyword, sortBy = 'id', sortOrder = 'DESC') {
        const offset = (page - 1) * limit;
        let query = `
            SELECT 
                a.id as actionId,
                a.device_id as deviceId,
                a.device_id as deviceCode,
                COALESCE(d.device_name, a.device_id) as deviceName, 
                a.action as action, 
                COALESCE(a.status, a.action) as status, 
                a.created_at as time,
                COALESCE(a.response_time, DATE_ADD(a.created_at, INTERVAL 1 SECOND)) as responseTime
            FROM action_history a
            LEFT JOIN devices d ON a.device_id COLLATE utf8mb4_unicode_ci = d.device_code COLLATE utf8mb4_unicode_ci
        `;
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM action_history a
            LEFT JOIN devices d ON a.device_id COLLATE utf8mb4_unicode_ci = d.device_code COLLATE utf8mb4_unicode_ci
        `;
        const params = [];

        if (searchBy && keyword) {
            let column = '';
            if (searchBy === 'thietbi' || searchBy === 'device') column = 'CONCAT(a.device_id, " ", COALESCE(d.device_name, ""))';
            else if (searchBy === 'deviceId') column = 'a.device_id';
            else if (searchBy === 'action') column = 'a.action';
            else if (searchBy === 'trangthai' || searchBy === 'status') column = 'COALESCE(a.status, a.action)';
            else if (searchBy === 'thoigian' || searchBy === 'time') column = 'a.created_at';
            else if (searchBy === 'all') {
                column = 'CONCAT(a.device_id, " ", COALESCE(d.device_name, ""), " ", a.action, " ", COALESCE(a.status, a.action), " ", a.created_at)';
            }

            if (column) {
                query += ` WHERE ${column} LIKE ?`;
                countQuery += ` WHERE ${column} LIKE ?`;
                params.push(`%${keyword}%`);
            }
        }

        const validSortColumns = ['id', 'deviceId', 'deviceName', 'action', 'status', 'time', 'responseTime'];
        const dbSortCol = {
            'id': 'a.id',
            'deviceId': 'a.device_id',
            'deviceName': 'd.device_name',
            'action': 'a.action',
            'status': 'COALESCE(a.status, a.action)',
            'time': 'a.created_at',
            'responseTime': 'COALESCE(a.response_time, a.created_at)'
        }[sortBy] || 'a.id';

        const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        
        query += ` ORDER BY ${dbSortCol} ${order} LIMIT ? OFFSET ?`;
        
        const queryParams = [...params, limit, offset];

        const [rows] = await db.execute(query, queryParams.map(p => typeof p === 'string' ? p : Number(p)));
        const [countRows] = await db.execute(countQuery, params);

        return {
            data: rows,
            total: countRows[0].total
        };
    }
}

module.exports = HistoryService;

