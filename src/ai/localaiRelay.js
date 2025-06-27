const { Events } = require('discord.js');
const config = require('../../config.json');

const CHANNEL_ID = config.localAIChannelId;
const LOCALAI_URL = config.localAIUrl; // Should be v2 endpoint, e.g. http://localhost:8080/v2/chat/completions
const LOCALAI_MODEL = config.localAIModel;
const LOCALAI_API_KEY = config.localAIApiKey || 'sk-no-key-required'; // Some LocalAI setups don't require API keys
const AI_SELF_FILTERING = config.aiSelfFiltering || { enabled: false };
const ADMIN_ROLE_ID = config.adminRoles[0]; // Use the first admin role for server alerts

// Dynamic import for node-fetch (ESM in CommonJS)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Helper function to generate AI-powered server issue response with admin ping
async function generateServerIssueResponse(context, message) {
  const adminRoleId = config.adminRoles[0]; // Use first admin role
  
  try {
    // Create a specialized prompt for server issue troubleshooting
    const troubleshootingContext = [
      {
        role: 'system',
        content: `You are a helpful technical support assistant in the GameNight Discord server. A user has reported what appears to be a SERVER-RELATED issue or problem.

Your task:
1. Analyze the reported server issue from the conversation context
2. Provide ONE simple, practical troubleshooting step the user can try immediately for server connectivity
3. Keep your response concise and user-friendly
4. Focus on the most common/likely solution for server connection problems
5. Use simple language that any user can understand

Format your response as a single helpful suggestion for server issues, like:
"Have you tried restarting your Minecraft client yet?"
"Try checking if you're using the correct server address"
"Check if other players are also experiencing connection issues"

Do NOT include admin ping information - that will be added automatically.`
      },
      ...context
    ];

    const aiResponse = await fetch(LOCALAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCALAI_API_KEY}`
      },
      body: JSON.stringify({
        model: LOCALAI_MODEL,
        messages: troubleshootingContext,
        max_tokens: 100,
        temperature: 0.3
      })
    });

    const data = await aiResponse.json();
    const aiSuggestion = data.choices?.[0]?.message?.content || data.choices?.[0]?.content || 'Try restarting the application and see if that helps';
    
    // Combine AI suggestion with admin ping
    const response = `${aiSuggestion.trim()}\n\nPinging <@&${adminRoleId}> for additional help! 🛠️`;
    
    return response;
  } catch (err) {
    console.error('Error generating server issue response:', err);
    // Fallback response
    return `Let me help you troubleshoot this issue.\n\nPinging <@&${adminRoleId}> for additional help! 🛠️`;
  }
}

// Helper function to check if message indicates a server issue that needs admin attention
function isServerIssue(content) {
  const serverIssueKeywords = [
    'server down', 'server is down', 'servers are down',
    'server offline', 'server crashed', 'server not working',
    'minecraft down', 'minecraft server down', 'game server down',
    'server dead', 'server broken', 'server not responding',
    'can\'t connect to server', 'server connection failed'
  ];
  
  const lowerContent = content.toLowerCase();
  return serverIssueKeywords.some(keyword => lowerContent.includes(keyword));
}

// Helper function to check if AI should respond
async function shouldAIRespond(context) {
  // If self-filtering is disabled, always respond
  if (!AI_SELF_FILTERING.enabled) {
    return true;
  }

  // Don't respond if there's no context
  if (!context || context.length === 0) {
    return false;
  }

  // Always respond to direct mentions, questions, or technical issues
  const lastMessage = context[context.length - 1];
  if (lastMessage && lastMessage.content) {
    const content = lastMessage.content.toLowerCase();
    
    // Direct questions or help requests
    if (content.includes('?') || content.includes('help') || content.includes('please')) {
      console.log('AI responding due to question/help request detected');
      return true;
    }
    
    // Technical issues and server problems
    const technicalKeywords = [
      'down', 'broken', 'not working', 'error', 'issue', 'problem', 
      'crash', 'offline', 'failed', 'bug', 'glitch', 'server',
      'minecraft', 'game', 'connection', 'timeout', 'lag'
    ];
    
    // Always respond to technical issues (these may need admin attention)
    const technicalIssueKeywords = ['down', 'broken', 'not working', 'offline', 'crashed', 'error', 'problem', 'issue', 'help', 'trouble', 'can\'t', 'cannot', 'won\'t', 'doesn\'t work'];
    if (technicalIssueKeywords.some(keyword => content.includes(keyword))) {
      console.log('AI responding due to technical issue detected (may need admin ping)');
      return true;
    }
    
    if (technicalKeywords.some(keyword => content.includes(keyword))) {
      console.log('AI responding due to technical issue detected');
      return true;
    }
    
    // Check if previous messages in context indicate an ongoing discussion
    const recentContext = context.slice(-3).map(msg => msg.content.toLowerCase()).join(' ');
    if (technicalKeywords.some(keyword => recentContext.includes(keyword))) {
      console.log('AI responding due to ongoing technical discussion');
      return true;
    }
    
    // Check for follow-up patterns that indicate continued discussion
    const followUpPatterns = [
      'i think', 'maybe', 'seems like', 'looks like', 'appears',
      'also', 'too', 'as well', 'same here', 'me too'
    ];
    
    if (followUpPatterns.some(pattern => content.includes(pattern)) && 
        technicalKeywords.some(keyword => recentContext.includes(keyword))) {
      console.log('AI responding due to follow-up in technical discussion');
      return true;
    }
  }

  try {
    const filteringPrompt = [
      {
        role: 'system',
        content: `You are a helpful assistant in a group chat. Your role is to decide whether you should respond to the conversation or not. 

Rules for responding:
- Only respond if you have something genuinely useful, interesting, or helpful to add
- Do NOT respond to simple greetings, casual conversations, or messages that don't need AI input
- Do NOT respond if the conversation is flowing naturally between humans
- DO respond if someone asks a direct question, needs help, or if you can provide valuable information
- DO respond if the conversation has stalled and you can meaningfully contribute
- DO respond if someone is asking for assistance or seems confused
- DO respond to technical issues, server problems, gaming issues, or troubleshooting discussions
- DO respond if someone mentions problems with servers, games, applications, or technical difficulties
- DO respond to ongoing problem-solving conversations where you can provide helpful insights

Analyze the conversation context and respond with ONLY "YES" if you should reply, or "NO" if you should stay silent. Do not provide any explanation, just YES or NO.`
      },
      ...context.slice(-5) // Only use last 5 messages for filtering to reduce token usage
    ];

    const filterResponse = await fetch(LOCALAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOCALAI_API_KEY}`
      },
      body: JSON.stringify({
        model: LOCALAI_MODEL,
        messages: filteringPrompt,
        max_tokens: AI_SELF_FILTERING.maxTokensForFiltering || 10,
        temperature: AI_SELF_FILTERING.responseThreshold || 0.1
      })
    });

    const filterData = await filterResponse.json();
    const shouldRespond = filterData.choices?.[0]?.message?.content?.trim().toUpperCase() || filterData.choices?.[0]?.content?.trim().toUpperCase() || 'NO';
    
    console.log(`AI filtering decision: ${shouldRespond} for message context`);
    return shouldRespond === 'YES';
  } catch (err) {
    console.error('AI filtering error:', err);
    // Default to not responding if filtering fails
    return false;
  }
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.channel.id !== CHANNEL_ID) return;

    try {
      // Fetch last 10 messages for context
      const messages = await message.channel.messages.fetch({ limit: 10 });
      // Sort by timestamp (oldest first)
      const sorted = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

      // Format for OpenAI/LocalAI
      const context = sorted.map(msg => ({
        role: msg.author.bot ? 'assistant' : 'user',
        content: msg.content
      }));

      // Add the new user message at the end if not already included
      if (context[context.length - 1]?.content !== message.content) {
        context.push({ role: 'user', content: message.content });
      }

      // Check if this might be a SERVER issue that needs immediate admin help
      const serverIssueKeywords = ['server down', 'server is down', 'servers are down', 'server offline', 'server crashed', 'server not working', 'minecraft down', 'minecraft server down', 'game server down', 'server dead', 'server broken', 'server not responding', 'can\'t connect to server', 'server connection failed'];
      const lastMessage = context[context.length - 1];
      const isActualServerIssue = lastMessage && serverIssueKeywords.some(keyword => 
        lastMessage.content.toLowerCase().includes(keyword)
      );
      
      if (isActualServerIssue && AI_SELF_FILTERING.adminPingOnServerIssues) {
        console.log('Server issue detected, generating AI-powered troubleshooting response with admin ping');
        const serverResponse = await generateServerIssueResponse(context, message);
        await message.reply(serverResponse);
        return;
      }

      // Check if AI should respond using self-filtering
      if (AI_SELF_FILTERING.enabled) {
        const shouldRespond = await shouldAIRespond(context);
        if (!shouldRespond) {
          console.log(`AI decided not to respond to message: "${message.content.substring(0, 50)}..."`);
          return;
        }
        console.log('AI decided to respond to the message');
      }

      // Check if this is a server issue that needs admin attention
      const needsAdminPing = isServerIssue(message.content) && AI_SELF_FILTERING.adminPingOnServerIssues;
      
      // Add system prompt for better responses
      let systemPrompt = 'You are a helpful assistant in the GameNight Discord server. You help with gaming issues, server problems, and technical support. Be concise, friendly, and natural in your responses. For technical issues, suggest simple troubleshooting steps users can try. Keep responses conversational and engaging. Focus on practical solutions and clear communication.';
      
      if (needsAdminPing) {
        systemPrompt += ' The user has reported a server issue. Acknowledge the issue and mention that admins have been notified.';
      }
      
      const enhancedContext = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...context
      ];

      const aiResponse = await fetch(LOCALAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOCALAI_API_KEY}`
        },
        body: JSON.stringify({
          model: LOCALAI_MODEL,
          messages: enhancedContext
        })
      });

      const data = await aiResponse.json();
      const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.content || 'Sorry, I could not generate a response.';

      // Send the reply with admin ping if it's a server issue
      if (needsAdminPing) {
        await message.reply(`<@&${ADMIN_ROLE_ID}> ${reply}`);
        console.log('Server issue detected - pinged admin role:', ADMIN_ROLE_ID);
      } else {
        await message.reply(reply);
      }
    } catch (err) {
      console.error('LocalAI relay error:', err);
      await message.reply('There was an error contacting the AI.');
    }
  });
};
