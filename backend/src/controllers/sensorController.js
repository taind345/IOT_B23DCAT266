const SensorService = require('../services/sensorService');

class SensorController {
    /**
     * API: GET /api/v1/sensors/data/latest 
     * (hoặc /api/sensors/latest theo MASTER_DOCUMENT)
     */
    static async getLatestData(req, res) {
        try {
            const data = await SensorService.getLatestSensorData();

            if (!data) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy dữ liệu cảm biến nào."
                });
            }

            return res.status(200).json({
                success: true,
                data: data
            });

        } catch (error) {
            console.error('Error in SensorController.getLatestData:', error);
            return res.status(500).json({
                success: false,
                message: "Lỗi Server Internal"
            });
        }
    }
}

module.exports = SensorController;
