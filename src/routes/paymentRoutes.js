const express = require("express");
const router = express.Router();
const {
    processPayment,
    getPaymentById,
    refundPayment,
    getPaymentHistory,
    getPaymentStats,
} = require("../controllers/paymentController");
const {
    extractUserFromToken,
    validateServiceToken,
    blockExternalRequests,
    admin,
} = require("../middleware/authMiddleware");

// Apply service token validation and user extraction to all routes
router.use(validateServiceToken);
router.use(extractUserFromToken);

// Payment processing routes
router.post("/process", processPayment);
router.get("/:id", getPaymentById);
router.post("/:id/refund", refundPayment);

// User routes
router.get("/history", getPaymentHistory);

// Admin routes
router.get("/admin/stats", admin, getPaymentStats);

module.exports = router;

