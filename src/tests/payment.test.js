const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../server");
const Payment = require("../models/Payment");

// Mock the auth middleware
jest.mock("../middleware/authMiddleware", () => ({
    protect: (req, res, next) => {
        req.user = {
            _id: new mongoose.Types.ObjectId(),
            name: "Test User",
            email: "test@example.com",
            isAdmin: false,
        };
        req.token = "test-token";
        next();
    },
    admin: (req, res, next) => {
        if (req.user && req.user.isAdmin) {
            next();
        } else {
            res.status(403);
            throw new Error("Not authorized as admin");
        }
    },
}));

// Mock the payment processor
jest.mock("../services/paymentProcessor", () => ({
    processPayment: jest.fn().mockResolvedValue({
        success: true,
        transactionId: "test-txn-123",
        message: "Payment processed successfully",
        details: {
            cardLast4: "1234",
        },
    }),
    processRefund: jest.fn().mockResolvedValue({
        success: true,
        refundId: "test-refund-123",
        message: "Refund processed successfully",
    }),
}));

// Mock the message queue
jest.mock("../utils/messageQueue", () => ({
    publishEvent: jest.fn().mockResolvedValue(true),
    setupRabbitMQ: jest.fn().mockResolvedValue(true),
    subscribeToEvent: jest.fn().mockResolvedValue(true),
}));

describe("Payment API", () => {
    beforeAll(async () => {
        // Connect to a test database before tests
        // This should be a separate test database
        const mongoURI =
            process.env.MONGODB_URI_TEST ||
            "mongodb://localhost:27017/payment-service-test";
        await mongoose.connect(mongoURI);
    });

    afterAll(async () => {
        // Clean up after tests
        await Payment.deleteMany({});
        await mongoose.connection.close();
    });

    beforeEach(async () => {
        // Clear the database before each test
        await Payment.deleteMany({});
    });

    describe("POST /api/payments", () => {
        it("should process a payment successfully", async () => {
            const paymentData = {
                orderId: new mongoose.Types.ObjectId().toString(),
                amount: 99.99,
                paymentMethod: "credit_card",
                paymentDetails: {
                    cardNumber: "4111111111111111",
                    expiryMonth: "12",
                    expiryYear: "2024",
                    cvv: "123",
                },
            };

            const res = await request(app)
                .post("/api/payments")
                .send(paymentData)
                .expect("Content-Type", /json/)
                .expect(200);

            expect(res.body.success).toBe(true);
            expect(res.body.payment).toHaveProperty("id");
            expect(res.body.payment).toHaveProperty("status", "completed");
            expect(res.body.payment).toHaveProperty(
                "transactionId",
                "test-txn-123"
            );
        });

        it("should return 400 if payment data is invalid", async () => {
            // Missing required fields
            const paymentData = {
                paymentMethod: "credit_card",
            };

            const res = await request(app)
                .post("/api/payments")
                .send(paymentData)
                .expect("Content-Type", /json/)
                .expect(400);

            expect(res.body).toHaveProperty("message");
        });
    });

    describe("GET /api/payments/order/:orderId", () => {
        it("should get a payment by order ID", async () => {
            // Create a test payment
            const orderId = new mongoose.Types.ObjectId().toString();
            const payment = await Payment.create({
                orderId,
                amount: 99.99,
                paymentMethod: "credit_card",
                status: "completed",
                transactionId: "test-txn-123",
                details: {
                    cardLast4: "1234",
                },
            });

            const res = await request(app)
                .get(`/api/payments/order/${orderId}`)
                .expect("Content-Type", /json/)
                .expect(200);

            expect(res.body).toHaveProperty("_id", payment._id.toString());
            expect(res.body).toHaveProperty("orderId", orderId);
            expect(res.body).toHaveProperty("status", "completed");
        });

        it("should return 404 if payment not found for order", async () => {
            const nonExistentOrderId = new mongoose.Types.ObjectId().toString();

            const res = await request(app)
                .get(`/api/payments/order/${nonExistentOrderId}`)
                .expect("Content-Type", /json/)
                .expect(404);

            expect(res.body).toHaveProperty("message");
        });
    });
});

