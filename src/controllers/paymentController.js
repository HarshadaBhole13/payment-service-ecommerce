const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const orderService = require("../services/orderService");
const paymentProcessor = require("../services/paymentProcessor");
const { publishEvent } = require("../utils/messageQueue");
const { generateServiceToken } = require("../middleware/authMiddleware");
const logger = require("../config/logger");

/**
 * @desc    Get all payments (admin only)
 * @route   GET /api/payments
 * @access  Private/Admin
 */
const getAllPayments = asyncHandler(async (req, res) => {
    const pageSize = 10;
    const page = Number(req.query.page) || 1;
    const status = req.query.status || "";

    // Build filter object
    const filterOptions = {};
    if (status) {
        filterOptions.status = status;
    }

    const count = await Payment.countDocuments(filterOptions);
    const payments = await Payment.find(filterOptions)
        .sort("-createdAt")
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({
        payments,
        page,
        pages: Math.ceil(count / pageSize),
        total: count,
    });
});

/**
 * @desc    Get payment by ID
 * @route   GET /api/payments/:id
 * @access  Private
 */
const getPaymentById = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
        res.status(404);
        throw new Error("Payment not found");
    }

    // Check if user is authorized to view this payment
    if (payment.user.toString() !== req.user.id && !req.user.isAdmin) {
        res.status(403);
        throw new Error("Not authorized to view this payment");
    }

    res.json(payment);
});

/**
 * @desc    Get payment for a specific order
 * @route   GET /api/payments/order/:orderId
 * @access  Private
 */
const getPaymentByOrderId = asyncHandler(async (req, res) => {
    const payment = await Payment.findOne({ order: req.params.orderId });

    if (!payment) {
        res.status(404);
        throw new Error("Payment not found for this order");
    }

    res.json(payment);
});

/**
 * @desc    Process a new payment
 * @route   POST /api/payments/process
 * @access  Private
 */
const processPayment = asyncHandler(async (req, res) => {
    const { orderId, paymentMethod, amount, cardDetails } = req.body;
    const userId = req.user.id;
    logger.info(`Processing payment for order ${orderId}`);

    if (!orderId || !paymentMethod || !amount) {
        res.status(400);
        throw new Error("Missing required payment information");
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
        logger.error(`Invalid orderId format: ${orderId}`);
        return res.status(400).json({
            success: false,
            message: "Invalid order ID format",
        });
    }

    if (
        paymentMethod === "Credit Card" &&
        (!cardDetails || !cardDetails.cardNumber || !cardDetails.cvv)
    ) {
        res.status(400);
        throw new Error("Card details are required for credit card payments");
    }

    try {
        const order = await orderService.getOrderById(orderId);
        if (!order) {
            res.status(404);
            throw new Error("Order not found");
        }

        if (
            req.user &&
            order.user.toString() !== req.user.id &&
            !req.user.isAdmin
        ) {
            res.status(403);
            throw new Error("Not authorized to process payment for this order");
        }

        const paymentResult = {
            success: true,
            transactionId: `tx_${Date.now()}_${Math.floor(
                Math.random() * 10000
            )}`,
            status: "completed",
            timestamp: new Date().toISOString(),
        };

        const existingPayment = await Payment.findOne({
            $or: [{ order: orderId }, { orderId: orderId }],
        });

        if (existingPayment) {
            logger.info(
                `Payment already exists for order ${orderId}: ${existingPayment._id}`
            );
            return res.status(400).json({
                success: false,
                message: "Payment already exists for this order",
                paymentId: existingPayment._id,
            });
        }

        const orderObjectId = mongoose.Types.ObjectId.isValid(orderId)
            ? new mongoose.Types.ObjectId(orderId)
            : null;

        const paymentData = {
            order: orderObjectId,
            user: req.user ? req.user.id : order.user,
            amount,
            paymentMethod,
            status: paymentResult.status,
            transactionId: paymentResult.transactionId,
            cardDetails: cardDetails
                ? {
                      lastFour: cardDetails.cardNumber.slice(-4),
                      cardType: getCardType(cardDetails.cardNumber),
                      expiryDate: cardDetails.expDate,
                  }
                : null,
        };

        const payment = await Payment.create(paymentData);
        logger.info(`Payment created successfully: ${payment._id}`);

        const serviceToken = generateServiceToken();
        const updateResult = await orderService.updateOrderPaymentStatus(
            orderId,
            {
                paymentMethod,
                status: paymentResult.status,
                transactionId: paymentResult.transactionId,
            },
            serviceToken
        );

        if (!updateResult.success) {
            logger.error(
                `Failed to update order payment status: ${updateResult.message}`
            );
        }

        await publishEvent("payment.successful", {
            paymentId: payment._id,
            orderId: payment.order,
            userId: payment.user,
            amount,
            status: payment.status,
            transactionId: payment.transactionId,
        });

        res.status(201).json({
            success: true,
            id: payment._id,
            status: payment.status,
            timestamp: payment.createdAt,
            transactionId: payment.transactionId,
        });
    } catch (error) {
        logger.error(`Payment processing error: ${error.message}`);
        await publishEvent("payment.failed", {
            orderId: orderId,
            userId: userId,
            amount: amount,
            reason: error.message || "Payment processing failed",
        });
        res.status(500).json({
            success: false,
            message: error.message || "Payment processing failed",
        });
    }
});

// Helper function to determine card type from card number
function getCardType(cardNumber) {
    // Basic detection based on starting digits
    if (!cardNumber) return "Unknown";

    // Remove any spaces or dashes
    const cleanNumber = cardNumber.replace(/[\s-]/g, "");

    if (/^4/.test(cleanNumber)) return "Visa";
    if (/^5[1-5]/.test(cleanNumber)) return "Mastercard";
    if (/^3[47]/.test(cleanNumber)) return "American Express";
    if (/^6(?:011|5)/.test(cleanNumber)) return "Discover";

    return "Unknown";
}

/**
 * @desc    Update payment status (admin only)
 * @route   PUT /api/payments/:id/status
 * @access  Private/Admin
 */
const updatePaymentStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const paymentId = req.params.id;

    // Validate status
    if (!["pending", "completed", "failed", "refunded"].includes(status)) {
        res.status(400);
        throw new Error("Invalid status value");
    }

    // Check if payment exists
    let payment = await Payment.findById(paymentId);
    if (!payment) {
        res.status(404);
        throw new Error("Payment not found");
    }

    // If status is already the same, no need to update
    if (payment.status === status) {
        return res
            .status(200)
            .json({ message: "Status already updated", payment });
    }

    // Handle refund case
    if (status === "refunded" && payment.status === "completed") {
        const refundResult = await paymentProcessor.processRefund(
            payment.transactionId,
            payment.amount
        );

        if (!refundResult.success) {
            res.status(400);
            throw new Error(`Refund failed: ${refundResult.message}`);
        }

        payment.refundId = refundResult.refundId;

        // Publish payment refunded event
        publishEvent("payment.refunded", {
            paymentId: payment._id.toString(),
            orderId: payment.order,
            userId: payment.user,
            amount: payment.amount,
            transactionId: payment.transactionId,
            refundId: refundResult.refundId,
        });
    }

    // Update payment status
    payment.status = status;
    await payment.save();

    res.status(200).json({
        message: "Payment status updated",
        payment,
    });
});

/**
 * @desc    Process a refund
 * @route   POST /api/payments/:id/refund
 * @access  Private
 */
const refundPayment = asyncHandler(async (req, res) => {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
        res.status(404);
        throw new Error("Payment not found");
    }

    // Check if user is authorized to refund this payment
    if (payment.user.toString() !== req.user.id && !req.user.isAdmin) {
        res.status(403);
        throw new Error("Not authorized to refund this payment");
    }

    // Process refund
    const refundResult = await paymentProcessor.processRefund({
        paymentId: payment._id,
        amount: payment.amount,
        transactionId: payment.transactionId,
    });

    // Update payment status
    payment.status = "refunded";
    payment.refundedAt = Date.now();
    await payment.save();

    // Publish refund processed event
    await publishEvent("payment.refunded", {
        paymentId: payment._id,
        orderId: payment.order,
        amount: payment.amount,
    });

    res.json(payment);
});

/**
 * @desc    Get payment history for current user
 * @route   GET /api/payments/history
 * @access  Private
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
    const pageSize = 10;
    const page = Number(req.query.page) || 1;

    const count = await Payment.countDocuments({ user: req.user.id });
    const payments = await Payment.find({ user: req.user.id })
        .sort("-createdAt")
        .limit(pageSize)
        .skip(pageSize * (page - 1));

    res.json({
        payments,
        page,
        pages: Math.ceil(count / pageSize),
        total: count,
    });
});

/**
 * @desc    Get payment statistics (admin only)
 * @route   GET /api/payments/admin/stats
 * @access  Private/Admin
 */
const getPaymentStats = asyncHandler(async (req, res) => {
    const stats = await Payment.aggregate([
        {
            $group: {
                _id: null,
                totalPayments: { $sum: 1 },
                totalAmount: { $sum: "$amount" },
                averageAmount: { $avg: "$amount" },
            },
        },
    ]);

    const statusStats = await Payment.aggregate([
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
            },
        },
    ]);

    res.json({
        ...stats[0],
        statusStats,
    });
});

module.exports = {
    getAllPayments,
    getPaymentById,
    getPaymentByOrderId,
    processPayment,
    updatePaymentStatus,
    refundPayment,
    getPaymentHistory,
    getPaymentStats,
};
