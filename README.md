# GameNight Bot

A comprehensive Discord bot that tracks voice activity, provides AI-powered assistance, and promotes healthy gaming habits with automated meal plans and workout suggestions.

## Features

- 🕒 Real-time voice activity tracking
- 📈 Multiple time period views (daily, weekly, monthly, yearly, all-time)
- 🤝 User comparison functionality
- 🤖 AI-powered chat with configurable personalities
- 🥗 **AI Meal Plan & Workout System** - Automated healthy lifestyle suggestions
- 💾 Persistent data storage using MariaDB
- ⚡ Slash command support

## Commands

### Time Tracking
* `/timespent [period] [user]` - Shows time spent in voice channels
  * `period` - daily/weekly/monthly/yearly/all (default: all)
  * `user` - @user mention (default: yourself)
 
* `/compare <user1> <user2>` - Compare voice time between two users
  * `user1` - first @user mention
  * `user2` - second @user mention

* `/leaderboard [period] [page]` - Shows server leaderboard
  * `period` - daily/weekly/monthly/yearly/all (default: all)
  * `page` - Page number (default: 1)

### Activity Analysis
* `/average [user]` - Shows average daily voice time
  * `user` - @user mention (default: yourself)
  * Displays average time spent in voice per day

* `/stats [user]` - Shows detailed voice activity patterns
  * `user` - @user mention (default: yourself)
  * Displays hourly and daily activity graphs
  * Shows peak activity times and patterns

* `/serverstats` - Shows server-wide voice activity statistics
  * Displays server-wide activity patterns
  * Shows total users and average daily users
  * Includes hourly and daily activity graphs with user counts

### AI Meal Plan & Workouts
* `/aimealplan generate <type>` - Generate meal, snack, or workout on demand
  * `type` - meal/snack/workout
  
* `/aimealplan history <type> [count]` - View recent generation history
  * `type` - meals/snacks/workouts
  * `count` - Number of items to show (1-20, default: 5)

* `/aimealplan toggle` - Enable/disable automatic scheduling

* `/aimealplan schedule` - View current posting schedule

## Setup

### Basic Setup
1. Install dependencies: `npm install`
2. Configure `config.json` with your bot token and database credentials
3. Run: `npm start`

### AI Meal Plan System Setup
See [MEAL_PLAN_SETUP.md](MEAL_PLAN_SETUP.md) for detailed setup instructions for the AI-powered meal plan and workout system.

## Prerequisites

- Node.js 16.9.0 or higher
- Discord Bot Token  
- MariaDB database
- LocalAI instance (for AI features)
- Configure all credentials in `config.json`
