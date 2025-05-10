# Payment Service

A microservice component of the E-Commerce platform responsible for processing payments, handling refunds, and managing payment-related events.

## Overview

The Payment Service provides:

-   Payment processing
-   Payment status tracking
-   Refund processing
-   Payment history and statistics
-   Event publishing for payment lifecycle events

## Prerequisites

-   Node.js 14 or higher
-   MongoDB 4.4 or higher
-   RabbitMQ 3.8 or higher
-   Docker and Docker Compose
-   Kubernetes cluster (for production)

## Quick Start

1. **Clone the Repository**

    ```bash
    git clone https://github.com/your-org/payment-service.git
    cd payment-service
    ```

2. **Install Dependencies**

    ```bash
    npm install
    ```

3. **Environment Setup**
   Create a `.env` file:

    ```env
    PORT=8084
    MONGODB_URI=mongodb://localhost:27017/paymentdb
    JWT_SECRET=your_jwt_secret
    RABBITMQ_URL=amqp://localhost:5672
    ```

4. **Start the Service**

    ```bash
    # Development
    npm run dev

    # Production
    npm start
    ```

## API Documentation

### Protected User Routes

-   `POST /api/payments/process` - Process a new payment
-   `GET /api/payments/:id` - Get payment by ID
-   `POST /api/payments/:id/refund` - Process a refund
-   `GET /api/payments/history` - Get payment history

### Admin Routes

-   `GET /api/payments/admin/stats` - Get payment statistics

## Payment Model

### Payment Status

-   `pending` - Initial state
-   `completed` - Payment successful
-   `failed` - Payment failed
-   `refunded` - Payment refunded

### Payment Fields

-   `order` - Reference to order
-   `user` - Reference to user
-   `amount` - Payment amount
-   `paymentMethod` - Payment method (Credit Card, Debit Card, Pending)
-   `status` - Current payment status
-   `transactionId` - Unique transaction identifier
-   `cardDetails` - Masked card information
    -   `lastFour` - Last four digits
    -   `cardType` - Type of card
    -   `expiryDate` - Card expiry date
-   `refundId` - Refund transaction ID
-   `refundedAt` - Refund timestamp
-   `errorMessage` - Error details if payment fails

## Event Publishing

The service publishes the following events:

-   `payment.successful` - When payment is completed
-   `payment.failed` - When payment fails
-   `payment.refunded` - When payment is refunded

## Monitoring

-   Health check endpoint: `/health`
-   Request logging
-   Error tracking
-   Payment statistics
-   Event publishing status

## Troubleshooting

### Common Issues

1. Database Connection Issues

    - Check MongoDB connection string
    - Verify MongoDB service is running
    - Check network connectivity

2. Message Broker Issues

    - Check RabbitMQ URL configuration
    - Verify RabbitMQ service is running
    - Check event publishing status

3. Authentication Issues
    - Verify JWT secret configuration
    - Check service token validation
    - Verify user token extraction
