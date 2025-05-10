const winston = require("winston");
const { format, transports } = winston;

// Define log formats
const consoleFormat = format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.colorize(),
    format.printf(({ level, message, timestamp, ...metadata }) => {
        let metaStr = "";
        if (Object.keys(metadata).length > 0) {
            metaStr = JSON.stringify(metadata);
        }
        return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
);

const fileFormat = format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.json()
);

// Create logger with different transports based on environment
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    defaultMeta: { service: "payment-service" },
    transports: [
        // Always log to console
        new transports.Console({ format: consoleFormat }),
    ],
});

// Add file transport in production
if (process.env.NODE_ENV === "production") {
    logger.add(
        new transports.File({
            filename: "logs/payment-service-error.log",
            level: "error",
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );

    logger.add(
        new transports.File({
            filename: "logs/payment-service-combined.log",
            format: fileFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
}

// Create HTTP logger for Express middleware
logger.stream = {
    write: function (message) {
        logger.info(message.trim());
    },
};

module.exports = logger;
