const amqp = require("amqplib");
const Payment = require("../models/Payment");
const logger = require("../config/logger");
const RABBITMQ_URL = process.env.RABBITMQ_URL;
const EXCHANGE_NAME = "ecommerce_events";

let channel = null;

/**
 * Set up connection to RabbitMQ
 */
const setupRabbitMQ = async () => {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();

        // Create an exchange if it doesn't exist
        await channel.assertExchange(EXCHANGE_NAME, "topic", { durable: true });
        logger.info("Connected to message broker and exchange created");

        // Handle connection errors
        connection.on("error", (err) => {
            logger.error("RabbitMQ connection error:", err);
            setTimeout(setupRabbitMQ, 5000);
        });

        connection.on("close", () => {
            logger.info("Connection to RabbitMQ closed, reconnecting...");
            setTimeout(setupRabbitMQ, 5000);
        });

        return channel;
    } catch (error) {
        logger.error("Failed to connect to message broker:", error);
        setTimeout(setupRabbitMQ, 5000);
    }
};

/**
 * Publish a message to RabbitMQ
 */
const publishMessage = async (eventType, data) => {
    try {
        if (!channel) {
            logger.info(" RabbitMQ not connected, attempting to reconnect...");
            await setupRabbitMQ();
            if (!channel) {
                logger.error(" Failed to reconnect to RabbitMQ");
                return false;
            }
        }

        const message = JSON.stringify(data);
        const result = await channel.publish(
            EXCHANGE_NAME,
            eventType,
            Buffer.from(message),
            {
                persistent: true,
                contentType: "application/json",
                timestamp: Date.now(),
            }
        );

        logger.info(
            `Published ${eventType} event:`,
            JSON.stringify(data, null, 2)
        );
        return result;
    } catch (error) {
        logger.error(` Error publishing ${eventType} event:`, error);
        return false;
    }
};

module.exports = {
    setupRabbitMQ,
    publishMessage,
};

