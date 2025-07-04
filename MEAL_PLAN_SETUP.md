# Meal Plan & Workout System Setup Guide

## Overview
The automated meal plan and workout system generates and posts meals, snacks, and workouts to a designated Discord channel based on a configurable schedule.

## Setup Instructions

### 1. Configure Channel ID
1. Open `config.json`
2. Replace `"REPLACE_WITH_YOUR_CHANNEL_ID"` with your Discord channel ID where you want meal plans and workouts posted
3. To get a channel ID:
   - Enable Developer Mode in Discord (User Settings > Advanced > Developer Mode)
   - Right-click the channel and select "Copy ID"

### 2. Customize Schedule (Optional)
The default schedule is:
- **Meals**: 7:00 AM, 12:00 PM, 7:00 PM
- **Snacks**: 9:30 AM, 3:00 PM  
- **Workouts**: 8:00 AM, 1:30 PM, 5:00 PM, 8:30 PM

All times are in **Eastern Time (America/New_York timezone)**, which automatically handles daylight saving time transitions.

You can modify these times in `config.json` under `mealPlanSchedule`.

### 3. Start the Bot
Once configured, the system will automatically:
- Generate smart meal plans, snacks, and workouts
- Avoid repetition by tracking history
- Post content as rich Discord embeds at scheduled times
- Provide context-aware suggestions (time of day, progressive difficulty)

## Discord Commands

### `/aimealplan generate`
Generate a meal, snack, or workout on demand.

**Optional Requirements Parameter:**
- For **meals**: Specify ingredients or cuisine (e.g., "chicken and rice dinner", "vegetarian breakfast", "Italian lunch")
- For **snacks**: Specify base ingredients or style (e.g., "apple-based snack", "protein-rich", "no-bake treats")
- For **workouts**: Specify focus area or type (e.g., "cardio legs workout", "upper body strength", "yoga stretching")

**Examples:**
- `/aimealplan generate type:meal requirements:chicken and rice dinner`
- `/aimealplan generate type:snack requirements:apple-based healthy snack`
- `/aimealplan generate type:workout requirements:cardio legs focus`

### `/aimealplan history`
View recent history of meals, snacks, or workouts.

### `/aimealplan toggle`
Enable/disable the automatic scheduling system.

### `/aimealplan schedule`
View the current posting schedule.

## Features

### Smart Generation
- **Meals**: Budget-friendly, gaming-friendly, time-appropriate
- **Snacks**: Quick, easy, healthy options for gaming sessions
- **Workouts**: Progressive difficulty, context-aware (morning energy vs evening wind-down)
- **Performance Tracking**: Response times displayed in admin console logs for monitoring
- **Extended Timeout**: 10-minute timeout for requests ensures reliable generation

### History Tracking
- Prevents repetition of recent suggestions
- Tracks preparation times, calories, difficulty levels
- Maintains context for progressive workout plans
- Records response times for admin performance monitoring

### Scheduling
- Fully configurable posting times in Eastern Time (America/New_York)
- Automatic daylight saving time handling
- Can be enabled/disabled without losing schedule
- Automatic restart after bot reboots

## Content Generation
The system uses your configured LocalAI instance with the "nutritionist" personality to generate contextually appropriate content in structured JSON format.

## Data Storage
- History stored in `data/` directory as JSON files
- Automatically created on first run
- Persistent across bot restarts

## Troubleshooting

### System Not Starting
- Check that `wellnessChannelId` is set to a valid Discord channel ID
- Ensure the bot has permission to post in the configured channel
- Check console logs for initialization errors

### No Responses
- Verify LocalAI is running and accessible
- Check that the "nutritionist" personality is available
- Ensure LocalAI model is properly loaded

### Commands Not Working
- Verify the bot has slash command permissions in your server
- Check that commands were properly registered (restart bot if needed)
- Ensure user has permission to use the commands
