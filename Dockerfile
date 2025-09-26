# Use the official Node.js LTS image
# This ensures the image is using the current long-term support (LTS) version
FROM node:lts-slim

# Set the working directory inside the container
WORKDIR /app

# Copy package.json files for all services (better caching)
COPY package*.json ./
COPY main-bot/package*.json ./main-bot/
COPY services/weather-service/package*.json ./services/weather-service/

# Install dependencies for all services
RUN npm install
RUN cd main-bot && npm install
RUN cd services/weather-service && npm install

# Copy the rest of the application files
COPY . .

RUN mkdir -p /app/logs

# Expose ports for main bot and services
EXPOSE 3000 3001

# Command to run all services (using Node.js startup script)
CMD ["node", "scripts/start-all.js"]

# GitHub Actions annotation for Docker build caching
# This helps GitHub Actions identify cacheable layers to speed up CI/CD builds.
LABEL org.opencontainers.image.source=https://github.com/Baking-Bits/GameNightBot
LABEL org.opencontainers.image.description="GameNightBot"
