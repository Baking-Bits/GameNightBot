# GameNight Bot

A comprehensive Discord bot designed to enhance gaming communities with voice activity tracking, weather-based competitions, and AI-powered wellness features.

## 🌟 Features

### 🎮 **Voice Activity Tracking**
- Real-time voice channel monitoring
- Daily, weekly, monthly, and all-time statistics
- Interactive leaderboards and user comparisons
- Detailed analytics and activity patterns

### 🌦️ **Weather Competition System**
- Join with your postal code to compete in "shitty weather" challenges
- Automatic point awards for bad weather conditions (rain, snow, extreme temperatures)
- Global leaderboard with multi-region support (US, UK, Mexico, Denmark, and more)
- Real-time weather monitoring with fallback API support

### 🖥️ **CraftyControl Server Management**
- Comprehensive Minecraft server management via CraftyControl integration
- Real-time server status monitoring and dashboard
- Admin-controlled server operations (start, stop, restart, console commands)
- Multi-server support with organized status display

### 🥗 **AI Wellness System**
- AI-generated meal plans, snacks, and workout routines
- Automated daily scheduling with customizable requirements
- Healthy lifestyle recommendations for gamers
- Smart content generation that avoids repetition

### ⚙️ **Advanced Administration**
- Comprehensive admin panels for all systems
- Service health monitoring and statistics
- User management and system configuration
- Microservices architecture for reliability

## 🚀 Quick Start

### Prerequisites
- Node.js 16.9.0 or higher
- MariaDB database
- Discord Bot Token
- OpenWeatherMap API key (for weather features)
- LocalAI instance (for wellness features)
- CraftyControl instance (for Minecraft server management)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/GameNightBot.git
   cd GameNightBot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your bot:
   ```bash
   cp config.json.template config.json
   # Edit config.json with your credentials
   ```

4. Start the bot:
   ```bash
   npm run start:all
   ```

## 📋 Main Commands

### Voice Tracking
- `/voice stats [user]` - View voice activity statistics
- `/voice leaderboard [period]` - Server voice time leaderboard
- `/voice compare <user1> <user2>` - Compare two users' activity
- `/voiceadmin` - Admin panel for voice system management

### Weather Competition
- `/weather join <zipcode>` - Join the weather competition
- `/weather current` - Check your current weather and points
- `/weather shitty` - View the shitty weather leaderboard
- `/weather leave` - Leave the weather tracking system
- `/weatheradmin` - Admin panel for weather system management

### CraftyControl Server Management
- `/crafty` - Minecraft server management dashboard
  - Real-time server status monitoring
  - Start, stop, restart server operations (admin only)
  - Server console access and command execution
  - Multi-server environment support

### Wellness System
- `/wellness generate <type>` - Generate meal, snack, or workout
- `/wellnessadmin` - Admin panel for wellness system management

### General
- `/personality <name>` - Switch AI personality for chat interactions
- `/raffle` - Create and manage server raffles
- `/eventrole` - Manage event-based roles

## 🏗️ Architecture

The bot uses a microservices architecture:

- **Main Bot** (`main-bot/`) - Core Discord functionality and command handling
- **Weather Service** (`services/weather-service/`) - Dedicated weather API and point system
- **Shared Services** (`services/shared/`) - Common utilities and systems
- **ServiceManager** - Handles communication between services

## 🌍 Supported Regions

The weather system supports postal codes from:
- 🇺🇸 United States (ZIP codes)
- 🇬🇧 United Kingdom (Postcodes)
- 🇲🇽 Mexico (Códigos Postales)
- 🇩🇰 Denmark (Postnummer)
- And more regions via fallback geocoding

## 📊 Database

Uses MariaDB for persistent storage:
- Voice activity data
- Weather user tracking and points
- Wellness content history
- System configuration and logs

## 🔧 Configuration

Key configuration options in `config.json`:
- Discord bot token and guild settings
- Database connection details
- Weather API keys and channels
- Wellness system AI endpoint
- CraftyControl API credentials and server URLs
- Service authentication tokens

## 📚 Additional Documentation

- [Weather System Setup](WEATHER_COMMANDS_DATABASE_INTEGRATION.md)
- [Wellness System Setup](MEAL_PLAN_SETUP.md)
- [Privacy Policy](legal/privacy_policy.md)
- [Terms of Service](legal/ToS.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

---

*Designed to enhance gaming communities with data-driven insights and healthy lifestyle features.*
