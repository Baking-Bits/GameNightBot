## 🎯 Recruitment System Setup

Your recruitment system has been added to the bot status monitor! Here's how it works:

### ✅ **What's Already Done**
- **Automatic invite generation** in the bot logs channel (`1333093713412358186`)
- **Invite link displayed** in the bot status message
- **Member tracking** when someone joins using the recruitment invite
- **Automatic logging** of new recruitments to the bot logs channel

### 🔧 **Configuration Needed**

1. **Create a Recruitment Role** (if you want auto-role assignment):
   - In Discord, create a role for recruited members (e.g., "Recruited", "New Member", etc.)
   - Copy the role ID
   - Update `config.json`: Change `"recruitmentRoleId": "ROLE_ID_HERE"` to your actual role ID
   - Or set it to `null` if you don't want auto-role assignment

2. **Bot Permissions Required**:
   - ✅ `Create Instant Invite` (to generate the recruitment invite)
   - ✅ `Manage Roles` (to assign the recruitment role automatically)
   - ✅ `Send Messages` (to log recruitments)

### 🎮 **How It Works**

1. **Bot Status Message**: The recruitment invite link is shown in the bot status embed
2. **Someone Uses Invite**: When a new member joins using that specific invite
3. **Auto Role Assignment**: They automatically get the recruitment role (if configured)
4. **Logged to Channel**: A message is posted to the bot logs channel announcing the new recruitment

### 📊 **Example Bot Status Message**
```
🤖 Bot Status Monitor

🟢 Weather Service: UP
🟢 Voice Tracking: UP
🟢 Database: UP

👥 Recruitment Invite
Share this link to invite new members:
https://discord.gg/abc123

New members using this invite will be automatically assigned the recruitment role and logged here.

🕐 Last Updated
2 minutes ago • October 8, 2025 at 3:45 PM
```

### 🔄 **To Update Config Later**
```bash
# Edit the config file to add your recruitment role ID
# Replace ROLE_ID_HERE with your actual Discord role ID
```

The system is ready to use! Just restart the bot and the recruitment invite will appear in the status message. 🚀