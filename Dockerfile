# Use the official Node.js LTS image
# This ensures the image is using the current long-term support (LTS) version
FROM node:lts

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json files first (for better caching of dependencies)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["npm", "start"]

# GitHub Actions annotation for Docker build caching
# This helps GitHub Actions identify cacheable layers to speed up CI/CD builds.
LABEL org.opencontainers.image.source=https://github.com/Baking-Bits/GameNightBot
LABEL org.opencontainers.image.description="GameNightBot"
