const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const axios = require("axios");
const { UnauthorizedError } = require("../errors");
const logger = require("../config/logger");

// User service URL
const USER_SERVICE_URL =
    process.env.USER_SERVICE_URL || "http://localhost:8081";

/**
 * Middleware to protect routes - validates JWT token and attaches user to request
 */
const protect = asyncHandler(async (req, res, next) => {
    let token;

    // Check if token exists in Authorization header
    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(" ")[1];

            if (!token) {
                res.status(401);
                throw new Error("Not authorized, no token provided");
            }

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // In a microservices architecture, we could contact the User Service
            // to get the complete user details, but for this implementation we'll
            // just attach the decoded user ID to the request

            try {
                // Get user details from user service
                const response = await axios.get(
                    `${USER_SERVICE_URL}/api/users/${decoded.id}`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    }
                );

                // Attach user to request object
                req.user = response.data;
            } catch (error) {
                logger.error("Error getting user details:", error.message);
                // If we can't contact the user service, still allow the request to proceed
                // but with limited user data from the token
                req.user = { _id: decoded.id };
            }

            // Attach token to request for reuse in service-to-service calls
            req.token = token;

            next();
        } catch (error) {
            logger.error("Auth error:", error.message);
            res.status(401);

            if (error.name === "JsonWebTokenError") {
                throw new Error("Not authorized, invalid token");
            } else {
                throw new Error("Not authorized");
            }
        }
    } else {
        res.status(401);
        throw new Error("Not authorized, no token provided");
    }
});

/**
 * Middleware to restrict access to admin users only
 */
const admin = (req, res, next) => {
    if (req.user && req.user.isAdmin) {
        next();
    } else {
        res.status(403);
        throw new Error("Not authorized as admin");
    }
};

// Extract user info from token
const extractUserFromToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return next(); // No user token, proceed without user info
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user info to request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            isAdmin: decoded.isAdmin || false,
        };

        logger.debug("User info extracted from token:", {
            id: req.user.id,
            isAdmin: req.user.isAdmin,
        });

        next();
    } catch (error) {
        logger.error("Token validation error:", error.message);
        next(); // Proceed without user info
    }
};

// Validate service token for internal service calls
const validateServiceToken = (req, res, next) => {
    try {
        const authHeader = req.headers["x-service-token"];
        if (!authHeader) {
            throw new UnauthorizedError("No service token provided");
        }

        const decoded = jwt.verify(authHeader, process.env.SERVICE_SECRET);
        if (decoded.type !== "service") {
            throw new UnauthorizedError("Invalid service token");
        }

        // Attach service info to request
        req.service = decoded;
        next();
    } catch (error) {
        logger.error("Service token validation error:", error.message);
        throw new UnauthorizedError("Invalid service token");
    }
};

// Check if request is from API Gateway
const isFromApiGateway = (req) => {
    return (
        req.headers["x-service-token"] &&
        req.headers["x-service-token"].startsWith("Bearer ")
    );
};

// Middleware to block all external requests
const blockExternalRequests = (req, res, next) => {
    if (!isFromApiGateway(req)) {
        logger.error("Blocked external request:", {
            path: req.path,
            method: req.method,
            ip: req.ip,
        });
        throw new UnauthorizedError("Direct service access not allowed");
    }
    next();
};

// Generate service token for internal service calls
const generateServiceToken = () => {
    const serviceSecret =
        process.env.SERVICE_SECRET || "api_gateway_secret_key";

    logger.info(
        "Generating service token with secret",
        serviceSecret === process.env.SERVICE_SECRET
            ? "from environment"
            : "using fallback"
    );

    return jwt.sign(
        {
            service: "api-gateway",
            type: "service",
        },
        serviceSecret,
        { expiresIn: "1h" }
    );
};

module.exports = {
    protect,
    admin,
    extractUserFromToken,
    validateServiceToken,
    blockExternalRequests,
    generateServiceToken,
};
