const HistoryService = require('../services/historyService');

class HistoryController {
    static async getSensors(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 8; // Mặc định 8 bản ghi/trang theo mẫu Figma
            const { sensorType, keywordValue, keywordTime, searchBy, keyword, sortBy, sortOrder } = req.query;

            const result = await HistoryService.getSensorHistory(
                page, 
                limit, 
                sensorType || (searchBy === 'cambien' ? keyword : null), 
                keywordValue || (searchBy === 'giatri' ? keyword : null), 
                keywordTime || (searchBy === 'thoigian' ? keyword : null), 
                sortBy || 'id', 
                sortOrder || 'ASC'
            );

            res.json({
                success: true,
                data: result.data,
                pagination: {
                    currentPage: page,
                    limit,
                    totalItems: result.total,
                    totalPages: Math.min(Math.ceil(result.total / limit), 5)
                }
            });
        } catch (error) {
            console.error('Error fetching sensor history:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    static async getActions(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 8; // Mặc định 8 bản ghi/trang để có phân trang rõ ràng
            const { searchBy, keyword, sortBy, sortOrder } = req.query;

            const result = await HistoryService.getActionHistory(page, limit, searchBy, keyword, sortBy, sortOrder);

            res.json({
                success: true,
                data: result.data,
                pagination: {
                    currentPage: page,
                    limit,
                    totalItems: result.total,
                    totalPages: Math.min(Math.ceil(result.total / limit), 5)
                }
            });
        } catch (error) {
            console.error('Error fetching action history:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }
}

module.exports = HistoryController;
