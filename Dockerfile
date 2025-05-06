# Base image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose port
EXPOSE 8084

# Start the application
CMD ["npm", "start"] 