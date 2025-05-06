const amqp = require("amqplib");
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
        rabbitConnection.connection = await amqp.connect(rabbitmqUrl);
        rabbitConnection.channel =
            await rabbitConnection.connection.createChannel();

        // Ensure the exchange exists
        await rabbitConnection.channel.assertExchange(EXCHANGE_NAME, "topic", {
            durable: true,
        });

        logger.info("Connected to RabbitMQ");

        // Handle connection closure
        rabbitConnection.connection.on("close", () => {
            logger.info("RabbitMQ connection closed, reconnecting...");
            setTimeout(setupRabbitMQ, 5000);
        });

        return rabbitConnection.channel;
    } catch (error) {
        logger.error("RabbitMQ connection error:", error);
        // Retry connection
        setTimeout(setupRabbitMQ, 5000);
        return null;
    }
};

/**
 * Publish an event to RabbitMQ
 * @param {string} eventType - Type of event (e.g., 'payment.successful')
 * @param {Object} data - Event data to publish
 */
const publishEvent = async (eventType, data) => {
    try {
        if (!rabbitConnection.channel) {
            logger.info("RabbitMQ not connected, skipping message");
            return false;
        }

        const routingKey = eventType;
        const message = Buffer.from(JSON.stringify(data));

        rabbitConnection.channel.publish(EXCHANGE_NAME, routingKey, message, {
            persistent: true,
            contentType: "application/json",
        });

        logger.info(`[Event Published] ${eventType}:`, data);
        return true;
    } catch (error) {
        logger.error("Error publishing event:", error);
        return false;
    }
};

/**
 * Subscribe to events from RabbitMQ
 * @param {string} eventType - Type of event to subscribe to
 * @param {Function} callback - Callback function to handle the event
 */
const subscribeToEvent = async (eventType, callback) => {
    try {
        if (!rabbitConnection.channel) {
            logger.info("RabbitMQ not connected, cannot subscribe");
            return false;
        }

        // Create a queue with a unique name for this service
        const { queue } = await rabbitConnection.channel.assertQueue("", {
            exclusive: true,
        });

        // Bind the queue to the exchange for the specific event type
        await rabbitConnection.channel.bindQueue(
            queue,
            EXCHANGE_NAME,
            eventType
        );

        // Consume messages from the queue
        await rabbitConnection.channel.consume(queue, (msg) => {
            if (msg !== null) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    callback(content);
                    rabbitConnection.channel.ack(msg);
                } catch (error) {
                    logger.error("Error processing message:", error);
                    rabbitConnection.channel.nack(msg);
                }
            }
        });

        logger.info(`Subscribed to ${eventType} events`);
        return true;
    } catch (error) {
        logger.error("Error subscribing to event:", error);
        return false;
    }
};

module.exports = {
    setupRabbitMQ,
    publishEvent,
    subscribeToEvent,
    EXCHANGE_NAME,
};
