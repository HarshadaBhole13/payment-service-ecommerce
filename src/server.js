require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/database");
const { setupRabbitMQ } = require("./utils/messageQueue");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");
const paymentRoutes = require("./routes/paymentRoutes");
const logger = require("./config/logger");

// If JWT_SECRET is not set, provide a default but log a warning
if (!process.env.JWT_SECRET) {
    logger.warn(
        "JWT_SECRET is not set in environment variables. Using default secret which is insecure for production."
    );
    process.env.JWT_SECRET = "default_jwt_secret_only_for_development";
}

// Connect to MongoDB
connectDB();

// Connect to RabbitMQ
if (process.env.RABBITMQ_URL) {
    setupRabbitMQ().catch((err) => {
        logger.error(`Failed to setup RabbitMQ: ${err.message}`);
    });
}

// Initialize Express app
const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/payments", paymentRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "Payment Service" });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 8084;
app.listen(PORT, () => {
    logger.info(`Payment Service running on port ${PORT}`);
});

// Handle uncaught exceptions and rejections
process.on("uncaughtException", (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    process.exit(1);
});

process.on("unhandledRejection", (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    process.exit(1);
});

module.exports = app; // Export for testing
