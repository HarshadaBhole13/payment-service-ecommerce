const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "Order",
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: "User",
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentMethod: {
            type: String,
            enum: ["Credit Card", "Debit Card", "Pending"],
            default: "Pending",
        },
        status: {
            type: String,
            enum: ["pending", "completed", "failed", "refunded"],
            default: "pending",
        },
        transactionId: {
            type: String,
            required: true,
            unique: true,
        },
        cardDetails: {
            // Only store masked card details for security
            lastFour: String,
            cardType: String,
            expiryDate: String,
        },
        refundId: {
            type: String,
            default: null,
        },
        refundedAt: {
            type: Date,
            default: null,
        },
        errorMessage: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Index for faster lookups
paymentSchema.index({ order: 1 }, { unique: true });
paymentSchema.index({ transactionId: 1 }, { unique: true });
paymentSchema.index({ status: 1 });
paymentSchema.index({ user: 1 });

// Virtual field to check if payment is refundable
paymentSchema.virtual("isRefundable").get(function () {
    return this.status === "completed" && this.refundId === null;
});

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;
