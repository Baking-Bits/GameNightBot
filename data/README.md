# Data Directory

This directory contains all user data, backups, and sensitive information for the GameNight Bot.

## ⚠️ IMPORTANT: Privacy & Security

- **All files in this directory contain sensitive user data**
- **Never commit actual data files to git**
- **Data files are automatically ignored by .gitignore**

## Setup for New Developers

1. Copy the template files to create initial data files:
   ```bash
   cp data/weatherData.json.template data/weatherData.json
   cp data/apiUsage.json.template data/apiUsage.json
   cp data/mealHistory.json.template data/mealHistory.json
   cp data/snackHistory.json.template data/snackHistory.json
   cp data/workoutHistory.json.template data/workoutHistory.json
   ```

2. The bot will automatically populate these files with data as it runs

## File Descriptions

- `weatherData.json` - Weather tracking system data (users, scores, history)
- `apiUsage.json` - API usage tracking for rate limiting
- `mealHistory.json` - AI meal plan history
- `snackHistory.json` - Snack tracking data
- `workoutHistory.json` - Workout tracking data
- `backups/` - Automatic backups of data files

## Backup System

The bot automatically creates backups before major operations:
- Backups are stored in `data/backups/`
- Old backups are automatically cleaned up
- Backup files follow the pattern: `filename_YYYY-MM-DDTHH-mm-ss-sssZ_reason.json`

## Development Notes

- All data files are created automatically if they don't exist
- The bot has built-in data protection and backup systems
- Template files show the expected structure for each data file
