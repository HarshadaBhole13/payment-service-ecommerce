require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/database");
const { setupRabbitMQ } = require("./messaging/setup");
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

// Initialize Express
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

// Initialize RabbitMQ connection
const initializeRabbitMQ = async () => {
    let retries = 5;
    while (retries > 0) {
        try {
            await setupRabbitMQ();
            logger.info("RabbitMQ initialization completed");
            return true;
        } catch (error) {
            retries--;
            logger.error(
                `Failed to initialize RabbitMQ (${retries} retries left):`,
                error
            );
            if (retries === 0) {
                throw error;
            }
            // Wait for 5 seconds before retrying
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }
    }
};

const validateEnvironmentVariables = () => {
    const requiredVars = [
        "PORT",
        "MONGODB_URI",
        "JWT_SECRET",
        "SERVICE_SECRET",
        "RABBITMQ_URL",
        "USER_SERVICE_URL",
        "ORDER_SERVICE_URL",
        "NOTIFICATION_SERVICE_URL",
    ];

    requiredVars.forEach((varName) => {
        if (!process.env[varName]) {
            logger.error(`Environment variable ${varName} is not set.`);
        }
    });
};

// Start the server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();
        logger.info("Connected to MongoDB");

        validateEnvironmentVariables();

        // Initialize RabbitMQ
        await initializeRabbitMQ();

        // Start HTTP server
        const PORT = process.env.PORT;
        app.listen(PORT, () => {
            logger.info(`Payment Service running on port ${PORT}`);
        });
    } catch (error) {
        logger.error("Failed to start server:", error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    process.exit(0);
});

// Start the server
startServer();

module.exports = app; // Export for testing
