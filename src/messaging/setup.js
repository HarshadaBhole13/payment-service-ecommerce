const amqp = require("amqplib");
const Payment = require("../models/Payment");
const logger = require("../config/logger");
const EXCHANGE_NAME = "ecommerce_events";
const rabbitmqUrl = process.env.RABBITMQ_URL || "amqp://localhost:5672";

const rabbitConnection = {
    connection: null,
    channel: null,
};

/**
 * Set up connection to RabbitMQ
 */
const setupRabbitMQ = async () => {
    try {
        logger.info(" Setting up payment service messaging...");
        rabbitConnection.connection = await amqp.connect(rabbitmqUrl);
        rabbitConnection.channel =
            await rabbitConnection.connection.createChannel();

        // Ensure the exchange exists
        await rabbitConnection.channel.assertExchange(EXCHANGE_NAME, "topic", {
            durable: true,
        });
        logger.info(" Connected to RabbitMQ exchange:", EXCHANGE_NAME);

        logger.info(" Payment service messaging setup complete");

        // Handle connection closure
        rabbitConnection.connection.on("close", () => {
            logger.info(" RabbitMQ connection closed, reconnecting...");
            setTimeout(setupRabbitMQ, 5000);
        });

        return rabbitConnection.channel;
    } catch (error) {
        logger.error(" RabbitMQ connection error:", error);
        setTimeout(setupRabbitMQ, 5000);
        return null;
    }
};

/**
 * Publish a message to RabbitMQ
 */
const publishMessage = async (eventType, data) => {
    try {
        if (!rabbitConnection.channel) {
            logger.info(" RabbitMQ not connected, cannot publish");
            return false;
        }

        // Publish the data directly without wrapping it in another object
        const message = JSON.stringify(data);
        await rabbitConnection.channel.publish(
            EXCHANGE_NAME,
            eventType,
            Buffer.from(message),
            { persistent: true }
        );
        logger.info(
            `📤 Published ${eventType} event:`,
            JSON.stringify(data, null, 2)
        );
        return true;
    } catch (error) {
        logger.error(` Error publishing ${eventType} event:`, error);
        return false;
    }
};

module.exports = {
    setupRabbitMQ,
    publishMessage,
};
