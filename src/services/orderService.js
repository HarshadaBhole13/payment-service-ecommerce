const axios = require("axios");
const { generateServiceToken } = require("../middleware/authMiddleware");
const logger = require("../config/logger");
const orderServiceUrl = process.env.ORDER_SERVICE_URL;

/**
 * Update an order's status in the Order Service
 * @param {string} orderId - The ID of the order to update
 * @param {string} status - The new status
 * @param {string} token - JWT token for authentication
 * @returns {Promise<Object>} - Response object
 */
const updateOrderStatus = async (orderId, status, token) => {
    try {
        const response = await axios.put(
            `${orderServiceUrl}/api/orders/internal/${orderId}/status`,
            { status },
            {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            }
        );
        return { success: true, order: response.data };
    } catch (error) {
        console.error("Error updating order status:", error.message);
        return {
            success: false,
            message:
                error.response?.data?.message ||
                "Error communicating with Order Service",
        };
    }
};

/**
 * Update an order's payment status
 * @param {string} orderId - The ID of the order
 * @param {string} token - Service token for authentication
 * @returns {Promise<Object>} - Response object
 */
const updateOrderPaymentStatus = async (orderId, paymentData, token) => {
    try {
        logger.info(`Updating order payment status for order ${orderId}`);
        const response = await axios.put(
            `${orderServiceUrl}/api/orders/internal/${orderId}/pay`,
            {
                id: orderId,
                status: "paid",
                update_time: new Date().toISOString(),
                email_address: "customer@example.com",
                paymentMethod: paymentData.paymentMethod,
                paymentResult: {
                    id: paymentData.transactionId,
                    status: paymentData.status,
                    update_time: new Date().toISOString(),
                    email_address: "customer@example.com",
                },
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-service-token": token,
                },
            }
        );
        logger.info("Order payment status update successful");
        return { success: true, order: response.data };
    } catch (error) {
        console.error("Error updating order payment status:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
            console.error("Response status:", error.response.status);
        }
        return {
            success: false,
            message:
                error.response?.data?.message ||
                "Error communicating with Order Service",
        };
    }
};

/**
 * Get order by ID using internal service authentication
 * @param {string} orderId - The ID of the order
 * @returns {Promise<Object>} - The order object or null
 */
const getOrderById = async (orderId) => {
    try {
        const serviceToken = generateServiceToken();

        const response = await axios.get(
            `${orderServiceUrl}/api/orders/internal/${orderId}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "x-service-token": serviceToken,
                },
            }
        );

        return response.data;
    } catch (error) {
        console.error("Error getting order details:", error.message);
        return null;
    }
};

module.exports = {
    updateOrderStatus,
    updateOrderPaymentStatus,
    getOrderById,
};
