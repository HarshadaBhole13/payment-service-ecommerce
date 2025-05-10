const { v4: uuidv4 } = require('uuid');

/**
 * Mocked payment processor service for simulating payment processing
 * In a production environment, this would be replaced with an actual payment gateway.
 */

/**
 * Process a payment through a payment processor
 * @param {number} amount - The payment amount
 * @param {string} paymentMethod - The payment method (credit_card, paypal, bank_transfer)
 * @param {Object} paymentDetails - Additional payment details
 * @returns {Promise<Object>} - Response object with success status and transaction details
 */
const processPayment = async (amount, paymentMethod, paymentDetails = {}) => {
    return new Promise(resolve => {
        // Simulate processing time
        setTimeout(() => {
            // Generate a random success/failure (90% success rate)
            const isSuccessful = Math.random() < 0.9;

            if (isSuccessful) {
                resolve({
                    success: true,
                    transactionId: `txn_${uuidv4()}`,
                    message: 'Payment processed successfully',
                    details: simulatePaymentResponse(paymentMethod, paymentDetails)
                });
            } else {
                // Generate a random error
                const error = simulatePaymentError(paymentMethod);
                resolve({
                    success: false,
                    message: error
                });
            }
        }, 1000); // Simulate 1 second processing time
    });
};

/**
 * Process a refund
 * @param {string} transactionId - The original transaction ID
 * @param {number} amount - The refund amount
 * @returns {Promise<Object>} - Response object with success status and refund details
 */
const processRefund = async (transactionId, amount) => {
    return new Promise(resolve => {
        // Simulate processing time
        setTimeout(() => {
            // Generate a random success/failure (95% success rate for refunds)
            const isSuccessful = Math.random() < 0.95;

            if (isSuccessful) {
                resolve({
                    success: true,
                    refundId: `ref_${uuidv4()}`,
                    message: 'Refund processed successfully'
                });
            } else {
                // Generate a random error
                const errorMessages = [
                    'Refund rejected by payment processor',
                    'Transaction too old to refund',
                    'Invalid transaction ID'
                ];
                const errorIndex = Math.floor(Math.random() * errorMessages.length);

                resolve({
                    success: false,
                    message: errorMessages[errorIndex]
                });
            }
        }, 800); // Simulate 800ms processing time
    });
};

/**
 * Simulate a payment response with additional details 
 * based on the payment method
 */
const simulatePaymentResponse = (paymentMethod, paymentDetails) => {
    const details = {};

    switch (paymentMethod) {
        case 'credit_card':
            details.cardLast4 = paymentDetails.cardNumber?.slice(-4) || '1234';
            details.expiryMonth = paymentDetails.expiryMonth || '12';
            details.expiryYear = paymentDetails.expiryYear || '2025';
            break;
        case 'paypal':
            details.paypalEmail = paymentDetails.email || 'customer@example.com';
            break;
        case 'bank_transfer':
            details.bankAccount = paymentDetails.bankAccount?.slice(-4) || '9876';
            break;
    }

    return details;
};

/**
 * Simulate different payment errors based on the payment method
 */
const simulatePaymentError = (paymentMethod) => {
    const commonErrors = [
        'Payment processing failed',
        'Network error during processing',
        'Service temporarily unavailable'
    ];

    const specificErrors = {
        credit_card: [
            'Card declined',
            'Insufficient funds',
            'Card expired',
            'Invalid card number',
            'CVV verification failed'
        ],
        paypal: [
            'PayPal account not verified',
            'PayPal session expired',
            'PayPal account restrictions'
        ],
        bank_transfer: [
            'Bank account verification failed',
            'Bank rejected the transfer',
            'Daily limit exceeded'
        ]
    };

    // 70% chance of payment method specific error, 30% chance of common error
    if (Math.random() < 0.7 && specificErrors[paymentMethod]) {
        const methodErrors = specificErrors[paymentMethod];
        const errorIndex = Math.floor(Math.random() * methodErrors.length);
        return methodErrors[errorIndex];
    } else {
        const errorIndex = Math.floor(Math.random() * commonErrors.length);
        return commonErrors[errorIndex];
    }
};

module.exports = {
    processPayment,
    processRefund
}; 