# AI Self-Filtering Documentation

## Overview
The AI Self-Filtering feature helps the bot determine when it should and shouldn't respond to messages in the designated AI channel. This prevents the AI from responding to every message and makes conversations more natural.

## How It Works

### Two-Stage Process
1. **Pre-filtering Check**: Before generating a response, the AI analyzes the conversation context and decides whether it should respond
2. **Response Generation**: If the AI decides to respond, it generates an appropriate reply using the enhanced system prompt

### Smart Decision Making
The AI considers several factors when deciding whether to respond:
- **Direct questions or help requests**: Always responds to messages containing "?", "help", or "please"
- **Conversation flow**: Avoids interrupting natural human-to-human conversations
- **Value addition**: Only responds when it can add something useful or interesting
- **Context analysis**: Uses the last 5 messages to understand the conversation context

## Configuration Options

In `config.json`, under the `aiSelfFiltering` section:

```json
"aiSelfFiltering": {
  "enabled": true,
  "responseThreshold": 0.2,
  "maxTokensForFiltering": 10,
  "adminPingOnServerIssues": true,
  "silentFailureOnAIUnavailable": true
}
```

### Configuration Parameters

- **`enabled`** (boolean): 
  - `true`: AI self-filtering is active
  - `false`: AI responds to all messages (classic behavior)

- **`responseThreshold`** (number, 0.0-1.0):
  - Controls the AI's "confidence" threshold for filtering decisions
  - Lower values (like 0.1) make the AI more conservative (less likely to respond)
  - Higher values make the AI more likely to respond

- **`maxTokensForFiltering`** (number):
  - Maximum tokens used for the filtering decision
  - Recommended: 10-20 tokens (just enough for "YES" or "NO")
  - Higher values waste resources since we only need a simple decision

- **`adminPingOnServerIssues`** (boolean):
  - `true`: Automatically ping admin role when server issues are detected
  - `false`: Only provide regular AI responses to server issues
  - When enabled, provides troubleshooting steps and pings the first admin role in config

- **`silentFailureOnAIUnavailable`** (boolean):
  - `true`: Bot stays completely silent when AI is unreachable (recommended)
  - `false`: Bot sends "There was an error contacting the AI" message when AI fails
  - Prevents error messages from cluttering the chat when AI service is down

## System Prompts

### Filtering Prompt
The AI uses a specialized system prompt for deciding whether to respond:
- Emphasizes only responding when adding value
- Encourages restraint in casual conversations
- Promotes responsiveness to questions and help requests

### Response Prompt
When generating actual responses, the AI uses an enhanced system prompt that:
- Encourages concise, friendly, and natural responses
- Discourages verbose or repetitive content
- Promotes conversational and engaging interactions

## Benefits

1. **More Natural Conversations**: The bot doesn't interrupt every human conversation
2. **Reduced Noise**: Less unnecessary AI chatter in the channel
3. **Better User Experience**: AI responds when it's actually helpful
4. **Resource Efficiency**: Fewer unnecessary AI calls save computational resources
5. **Contextual Awareness**: AI understands when its input is valuable vs. when it should stay silent
6. **Proactive Server Support**: Automatic troubleshooting help and admin notifications for server issues

## Server Issue Detection & Response

When `adminPingOnServerIssues` is enabled, the bot automatically detects SERVER-RELATED problems and provides immediate help with admin notification:

### Automatic Server Issue Detection
The bot specifically watches for server-related keywords:
- **Server status**: "server down", "server is down", "servers are down", "server offline", "server crashed"
- **Server connectivity**: "can't connect to server", "server connection failed", "server not responding"
- **Game servers**: "minecraft server down", "game server down", "minecraft down"

Note: General technical issues (like "Discord won't work" or "my game is broken") will NOT trigger admin pings - only server-specific problems will.

### Immediate Response for Server Issues
When a server issue is detected, the bot:
1. **Analyzes the specific server problem** - Uses AI to understand the server connectivity issue
2. **Generates targeted server troubleshooting steps** - AI provides relevant suggestions for server problems
3. **Pings admin role** - Automatically notifies admins since server issues may require admin intervention
4. **Bypasses normal filtering** - Always responds to server issues regardless of other filtering rules

### AI-Powered Server Troubleshooting
For server issues specifically, the AI:
- Focuses on server connectivity and access problems
- Suggests client-side fixes users can try before admin intervention
- Provides server-specific troubleshooting steps
- Understands different types of game servers and services

### Example Server Issue Responses
The AI might suggest:
- **For Minecraft server down**: "Have you tried restarting your Minecraft client yet?"
- **For server connection issues**: "Try checking if you're using the correct server address"
- **For game server problems**: "Check if other players are also experiencing connection issues"

Each server issue response ends with: "Pinging @AdminRole for additional help! 🛠️"

### Non-Server Technical Issues
For general technical problems that are NOT server-related (like Discord issues, game crashes, software problems), the bot will:
- Still provide helpful AI responses and troubleshooting
- NOT ping the admin role (since these don't require server administration)
- Follow normal self-filtering rules

## Fallback Behaviors

- If filtering fails due to errors, the AI defaults to **not responding** (conservative approach)
- If self-filtering is disabled, the AI responds to all messages as before
- Direct questions and help requests always trigger a response regardless of other factors
- **AI Unavailable**: When the AI service is unreachable:
  - If `silentFailureOnAIUnavailable` is `true`: Bot stays completely silent (recommended)
  - If `silentFailureOnAIUnavailable` is `false`: Bot sends error message to chat
- **Server Issues**: If AI fails during server issue detection, no admin ping occurs (prevents false alerts)

## Monitoring

The bot logs filtering decisions to help with debugging and optimization:
- "AI decided not to respond to message: [preview]" - when AI chooses silence
- "AI decided to respond to the message" - when AI chooses to respond
- "AI responding due to question/help request detected" - when auto-responding to questions

## Customization

You can modify the filtering behavior by adjusting:
1. The system prompt in the `shouldAIRespond` function
2. The trigger words for auto-response (currently: "?", "help", "please")
3. The number of context messages used for filtering (currently: last 5 messages)
4. The configuration parameters in `config.json`

### Dynamic Personality Changes

Admins can change the AI personality in real-time using Discord commands:

#### `/personality show`
- Displays the current personality setting
- Shows all available personality options
- Admin-only command

#### `/personality set <level>`
- Changes the AI personality level immediately
- Available levels: `professional`, `casual`, `playful`
- Changes take effect for new AI responses instantly
- Admin-only command

**Example Usage:**
```
/personality show
/personality set playful
/personality set professional
```

**Personality Levels:**
- **Professional**: Professional but friendly tone
- **Casual**: Casual and friendly with gaming terminology  
- **Playful**: Witty with gaming metaphors and culture references

Changes made via Discord commands are automatically saved to the config file and take effect immediately without requiring a bot restart.
