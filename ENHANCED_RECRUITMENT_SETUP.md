# 🎯 Enhanced Recruitment System Setup

## ✅ **New Features Added**

### **Authorized Inviter System**
- Members with specific roles can invite people and approve their access level
- Inviters receive a DM when someone uses their invite
- Approval system for recruitment role and hidden channel access

### **Two-Tier Access Control**
1. **Recruitment Role** - Basic recruited member status
2. **Hidden Channel Access** - Additional access to private channels

## 🔧 **Configuration Required**

### **Update config.json:**

```json
{
  "recruitmentSettings": {
    "authorizedInviterRoles": ["ROLE_ID_1", "ROLE_ID_2"],
    "hiddenChannelRoleId": "HIDDEN_CHANNEL_ROLE_ID", 
    "approvalTimeoutMinutes": 60
  }
}
```

### **Required Role IDs:**

1. **authorizedInviterRoles**: Array of role IDs that can invite and approve members
   - Example: `["1260973600492752927", "1205336317291143208"]`
   - These users will get approval prompts when their invites are used

2. **hiddenChannelRoleId**: Role ID that grants access to hidden voice channels
   - Create a role for private channel access
   - Add this role ID to the config

3. **approvalTimeoutMinutes**: How long approval requests stay active (default: 60 minutes)

## 🎮 **How It Works**

### **Scenario 1: Bot's Recruitment Invite Used**
- ✅ **Auto-assigns recruitment role** immediately
- ✅ **Logs to bot logs channel**
- ❌ **No approval needed** (existing behavior)

### **Scenario 2: Authorized Member's Invite Used**
1. **Someone uses an authorized member's invite**
2. **Inviter gets a DM** with approval buttons:
   - `✅ Recruitment Role Only` - Assigns recruitment role
   - `🔓 Hidden Channels Access` - Assigns recruitment role + hidden channel role  
   - `❌ No Special Access` - No roles assigned
3. **Decision logged** to bot logs channel
4. **Timeout** - Request expires after configured minutes

### **Scenario 3: Regular Member's Invite Used**
- ✅ **Logs join** to bot logs channel
- ❌ **No approval prompt** (member not authorized)
- ❌ **No automatic roles** assigned

## 📋 **Setup Steps**

### **1. Create Roles (if needed)**
```
1. Create "Hidden Channels" role in Discord
2. Set up private voice channel permissions for this role
3. Copy the role ID
```

### **2. Update Config**
```json
"recruitmentSettings": {
  "authorizedInviterRoles": ["YOUR_MODERATOR_ROLE_ID", "YOUR_TRUSTED_MEMBER_ROLE_ID"],
  "hiddenChannelRoleId": "YOUR_HIDDEN_CHANNEL_ROLE_ID",
  "approvalTimeoutMinutes": 60
}
```

### **3. Assign Authorized Roles**
- Give the configured roles to trusted members who can invite others
- These members will get approval prompts for their invites

### **4. Test the System**
1. Have an authorized member create an invite
2. Use that invite with a test account
3. Check that the inviter gets a DM with approval buttons
4. Test the approval buttons work correctly

## 🔍 **Bot Logs Channel Output**

### **Member Joins (All Cases):**
```
👥 Member Joined
[User Avatar] @NewUser joined the server

👤 User: @NewUser
🔗 Invite: abc123  
👨‍💼 Inviter: @AuthorizedMember
📅 Joined: 2 minutes ago
📊 Invite Uses: 5
```

### **Approval Decision (Authorized Invites):**
```
✅ Member Approval Decision
@AuthorizedMember made a decision for @NewUser

👤 New Member: @NewUser
👨‍💼 Approver: @AuthorizedMember  
🔗 Invite Used: abc123
✅ Decision: Hidden Channels Access
```

## ⚠️ **Important Notes**

- **Bot needs DM permissions** to send approval requests to inviters
- **Approval requests expire** after the configured timeout
- **Only the inviter** can approve their own invites
- **All invite usage is logged** regardless of approval status
- **Multiple authorized roles** can be configured

## 🚀 **Ready to Use**

Once configured, restart the bot and the enhanced recruitment system will be active! Authorized members will start receiving approval prompts when their invites are used.