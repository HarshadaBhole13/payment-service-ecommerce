// Custom error classes for the application

class CustomAPIError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

class BadRequestError extends CustomAPIError {
    constructor(message) {
        super(message);
        this.statusCode = 400;
    }
}

class NotFoundError extends CustomAPIError {
    constructor(message) {
        super(message);
        this.statusCode = 404;
    }
}

class UnauthorizedError extends CustomAPIError {
    constructor(message) {
        super(message);
        this.statusCode = 401;
    }
}

class ForbiddenError extends CustomAPIError {
    constructor(message) {
        super(message);
        this.statusCode = 403;
    }
}

module.exports = {
    CustomAPIError,
    BadRequestError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError
}; 