const { Events } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getPersonalityPrompt } = require('../utils/personalities');

// Get fresh config for each request to allow dynamic updates
function getFreshConfig() {
  try {
    const configPath = path.join(__dirname, '../../config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (err) {
    console.error('Error reading config:', err);
    return require('../../config.json'); // Fallback to cached version
  }
}

// Get static config values that don't change dynamically
const staticConfig = require('../../config.json');
const CHANNEL_ID = staticConfig.localAIChannelId;
const LOCALAI_URL = staticConfig.localAIUrl; // Should be v2 endpoint, e.g. http://localhost:8080/v2/chat/completions
const LOCALAI_MODEL = staticConfig.localAIModel;
const LOCALAI_API_KEY = staticConfig.localAIApiKey || 'sk-no-key-required'; // Some LocalAI setups don't require API keys

// Dynamic import for node-fetch (ESM in CommonJS)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Rate limiting and batching system for handling rapid messages with conversation detection
const messageQueue = new Map(); // conversationKey -> { timeout, messages, participants }
const activeProcessing = new Set(); // Track conversation keys currently being processed
const botResponses = new Map(); // Track bot responses to edit instead of creating new ones
const BATCH_DELAY = 2000; // Wait 2 seconds for more messages before processing
const MAX_CONCURRENT_REQUESTS = 3; // Maximum simultaneous AI requests
const CONVERSATION_TIMEOUT = 300000; // 5 minutes - how long to consider messages part of same conversation

// Helper function to generate conversation key based on content and participants
function getConversationKey(message) {
  const content = message.content.toLowerCase();
  const userId = message.author.id;
  const channelId = message.channel.id;
  
  // Check for urgent issues that should be processed immediately (separate conversation)
  const urgentKeywords = [
    'server down', 'server crash', 'emergency', 'urgent', 'help',
    'not working', 'broken', 'error', 'issue', 'problem'
  ];
  
  const isUrgent = urgentKeywords.some(keyword => content.includes(keyword));
  
  if (isUrgent) {
    // Urgent messages get their own conversation thread to avoid delays
    return `${channelId}:urgent:${userId}:${Date.now()}`;
  }
  
  // Check for topic keywords to group related conversations
  const topicKeywords = {
    technical: ['server', 'minecraft', 'game', 'lag', 'connection', 'crash', 'bug'],
    social: ['good morning', 'hello', 'hi', 'how are', 'what\'s up', 'hey'],
    random: ['funny', 'lol', 'meme', 'random', 'off topic']
  };
  
  let topic = 'general';
  for (const [topicName, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => content.includes(keyword))) {
      topic = topicName;
      break;
    }
  }
  
  // Look for existing active conversations in this channel with same topic
  const existingConversationKey = findActiveConversation(channelId, topic, message);
  if (existingConversationKey) {
    return existingConversationKey;
  }
  
  // Create new conversation with timestamp
  return `${channelId}:${topic}:${Date.now()}`;
}

// Helper function to find active conversation that this message should join
function findActiveConversation(channelId, topic, message) {
  const now = Date.now();
  const conversationTimeout = 10 * 60 * 1000; // 10 minutes for conversation continuity
  
  // Look through existing conversations and bot responses
  for (const [conversationKey, responseData] of botResponses.entries()) {
    // Check if it's the same channel and topic
    if (conversationKey.startsWith(`${channelId}:${topic}:`)) {
      // Check if conversation is still active (within 10 minutes)
      const timeSinceLastActivity = now - responseData.timestamp;
      if (timeSinceLastActivity < conversationTimeout) {
        
        // Check if this message is a continuation of the conversation
        if (isContinuationOfConversation(message, responseData)) {
          console.log(`Joining existing conversation: ${conversationKey}`);
          return conversationKey;
        }
      }
    }
  }
  
  // Also check message queue for active conversations
  for (const [conversationKey, queueData] of messageQueue.entries()) {
    if (conversationKey.startsWith(`${channelId}:${topic}:`)) {
      const timeSinceLastActivity = now - queueData.lastActivity;
      if (timeSinceLastActivity < conversationTimeout) {
        
        // Check if this message continues the conversation
        const lastMessage = queueData.messages[queueData.messages.length - 1];
        if (isRelatedMessage(message, lastMessage)) {
          console.log(`Joining queued conversation: ${conversationKey}`);
          return conversationKey;
        }
      }
    }
  }
  
  return null; // No active conversation found
}

// Helper function to check if message continues an existing conversation
function isContinuationOfConversation(newMessage, responseData) {
  const newContent = newMessage.content.toLowerCase();
  const originalContent = responseData.originalMessage.content.toLowerCase();
  
  // Check for continuation indicators
  const continuationPhrases = [
    'still', 'but', 'however', 'also', 'and', 'plus', 'additionally',
    'me too', 'same here', 'i have', 'what about', 'how about',
    'tried that', 'doesn\'t work', 'not working', 'still not'
  ];
  
  // Same user continuing their issue
  if (newMessage.author.id === responseData.originalMessage.author.id) {
    if (continuationPhrases.some(phrase => newContent.includes(phrase))) {
      return true;
    }
  }
  
  // Different user with related issue
  const commonKeywords = extractKeywords(originalContent);
  const newKeywords = extractKeywords(newContent);
  const sharedKeywords = commonKeywords.filter(kw => newKeywords.includes(kw));
  
  // If they share 2+ keywords, it's likely related
  return sharedKeywords.length >= 2;
}

// Helper function to check if messages are related
function isRelatedMessage(message1, message2) {
  const content1 = message1.content.toLowerCase();
  const content2 = message2.content.toLowerCase();
  
  const keywords1 = extractKeywords(content1);
  const keywords2 = extractKeywords(content2);
  const sharedKeywords = keywords1.filter(kw => keywords2.includes(kw));
  
  return sharedKeywords.length >= 1;
}

// Helper function to extract relevant keywords from content
function extractKeywords(content) {
  const relevantWords = [
    'server', 'minecraft', 'game', 'lag', 'connection', 'crash', 'bug',
    'error', 'issue', 'problem', 'broken', 'fix', 'help', 'working'
  ];
  
  return relevantWords.filter(word => content.includes(word));
}

// Helper function to determine if conversations should be merged or kept separate
function shouldMergeConversations(newMessage, existingMessages) {
  if (!existingMessages || existingMessages.length === 0) return true;
  
  const newContent = newMessage.content.toLowerCase();
  const lastMessage = existingMessages[existingMessages.length - 1];
  const lastContent = lastMessage.content.toLowerCase();
  
  // Don't merge if users are clearly talking about different things
  const topicChangeIndicators = [
    'anyway', 'btw', 'changing topic', 'different subject',
    'on another note', 'speaking of something else'
  ];
  
  if (topicChangeIndicators.some(indicator => newContent.includes(indicator))) {
    return false;
  }
  
  // Don't merge technical issues with casual chat
  const technicalKeywords = ['server', 'minecraft', 'bug', 'error', 'lag', 'crash'];
  const casualKeywords = ['lol', 'funny', 'meme', 'morning', 'hello'];
  
  const newIsTechnical = technicalKeywords.some(kw => newContent.includes(kw));
  const newIsCasual = casualKeywords.some(kw => newContent.includes(kw));
  const lastIsTechnical = technicalKeywords.some(kw => lastContent.includes(kw));
  const lastIsCasual = casualKeywords.some(kw => lastContent.includes(kw));
  
  if ((newIsTechnical && lastIsCasual) || (newIsCasual && lastIsTechnical)) {
    return false;
  }
  
  return true;
}

// Helper function to process batched messages
async function processBatchedMessages(conversationKey, messages) {
  if (activeProcessing.has(conversationKey)) {
    console.log(`Already processing conversation ${conversationKey}, skipping batch`);
    return;
  }

  activeProcessing.add(conversationKey);
  
  try {
    // Analyze all messages in the conversation for better context
    const participants = [...new Set(messages.map(msg => msg.author.username))];
    const messageCount = messages.length;
    
    // Determine priority - urgent messages or multiple users get priority
    const hasUrgentContent = conversationKey.includes('urgent');
    const multipleUsers = participants.length > 1;
    
    console.log(`Processing conversation: ${conversationKey}`);
    console.log(`- Participants: ${participants.join(', ')} (${participants.length} users)`);
    console.log(`- Messages: ${messageCount}`);
    console.log(`- Priority: ${hasUrgentContent ? 'URGENT' : multipleUsers ? 'MULTI-USER' : 'NORMAL'}`);
    
    // Find the most important message to respond to (instead of processing all)
    const mostImportantMessage = findMostImportantMessage(messages);
    
    if (mostImportantMessage) {
      console.log(`Responding to most important message from ${mostImportantMessage.author.username}: "${mostImportantMessage.content.substring(0, 50)}..."`);
      await processMessage(mostImportantMessage, conversationKey);
    } else {
      console.log(`No important message found in conversation, skipping response`);
    }
    
  } catch (error) {
    console.error('Error processing batched conversation:', error);
  } finally {
    activeProcessing.delete(conversationKey);
  }
}

// Helper function to find the most important message to respond to
function findMostImportantMessage(messages) {
  // Priority order: urgent keywords > questions > technical issues > latest message
  
  // 1. Check for urgent messages first
  const urgentKeywords = ['help', 'server down', 'not working', 'broken', 'emergency', 'urgent'];
  const urgentMessage = messages.find(msg => 
    urgentKeywords.some(kw => msg.content.toLowerCase().includes(kw))
  );
  if (urgentMessage) return urgentMessage;
  
  // 2. Check for direct questions
  const questionMessage = messages.find(msg => msg.content.includes('?'));
  if (questionMessage) return questionMessage;
  
  // 3. Check for technical issues
  const technicalKeywords = ['server', 'minecraft', 'bug', 'error', 'lag', 'crash', 'issue', 'problem'];
  const technicalMessage = messages.find(msg => 
    technicalKeywords.some(kw => msg.content.toLowerCase().includes(kw))
  );
  if (technicalMessage) return technicalMessage;
  
  // 4. Return the latest message if nothing else matches
  return messages[messages.length - 1];
}

// Helper function to add message to batch queue with conversation detection
function queueMessage(message) {
  const conversationKey = getConversationKey(message);
  
  // Check if we're at concurrent request limit
  if (activeProcessing.size >= MAX_CONCURRENT_REQUESTS) {
    console.log(`Rate limit reached (${MAX_CONCURRENT_REQUESTS} concurrent requests), queuing message`);
  }
  
  // Get existing conversation data
  const existingData = messageQueue.get(conversationKey);
  let messages = [];
  
  if (existingData) {
    // Check if we should merge with existing conversation
    if (shouldMergeConversations(message, existingData.messages)) {
      messages = existingData.messages;
      clearTimeout(existingData.timeout);
    } else {
      // Start new conversation thread
      console.log(`Starting new conversation thread (topic change detected)`);
    }
  }
  
  messages.push(message);
  
  // Track participants
  const participants = [...new Set(messages.map(msg => msg.author.id))];
  
  // Adjust batch delay based on conversation type
  let batchDelay = BATCH_DELAY;
  
  if (conversationKey.includes('urgent')) {
    batchDelay = 500; // Process urgent messages faster
  } else if (participants.length > 1) {
    batchDelay = 1500; // Slightly faster for multi-user conversations
  }
  
  // Set new timeout to process batch
  const timeout = setTimeout(() => {
    const queueData = messageQueue.get(conversationKey);
    if (queueData) {
      messageQueue.delete(conversationKey);
      processBatchedMessages(conversationKey, queueData.messages);
    }
  }, batchDelay);
  
  messageQueue.set(conversationKey, { 
    timeout, 
    messages, 
    participants: participants,
    lastActivity: Date.now()
  });
  
  console.log(`Queued message in conversation "${conversationKey}" (${messages.length} messages, ${participants.length} users, ${batchDelay}ms delay)`);
}

// Helper function to generate AI-powered server issue response with admin ping
async function generateServerIssueResponse(context, message) {
  const config = getFreshConfig();
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

    if (!aiResponse.ok) {
      console.error('AI response not OK for server issue:', aiResponse.status, aiResponse.statusText);
      return null; // Return null to indicate failure
    }

    const data = await aiResponse.json();
    const aiSuggestion = data.choices?.[0]?.message?.content || data.choices?.[0]?.content;
    
    if (!aiSuggestion) {
      console.error('No valid AI suggestion for server issue');
      return null; // Return null to indicate failure
    }
    
    // Combine AI suggestion with admin ping
    const response = `${aiSuggestion.trim()}\n\nPinging <@&${adminRoleId}> for additional help! 🛠️`;
    
    return response;
  } catch (err) {
    console.error('Error generating server issue response:', err);
    // If AI is not reachable, return null to indicate failure
    return null;
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

// Helper function to determine if admin should be pinged based on conversation context
function shouldPingAdmin(currentMessage, context, conversationKey, aiConfig) {
  if (!aiConfig.adminPingOnServerIssues) {
    return false;
  }
  
  // Check if current message is a server issue
  if (isServerIssue(currentMessage.content)) {
    console.log('Admin ping: Current message is server issue');
    return true;
  }
  
  // Check if conversation is about server issues (look at recent context)
  const recentMessages = context.slice(-5); // Last 5 messages
  const hasServerIssueInContext = recentMessages.some(msg => isServerIssue(msg.content));
  
  if (hasServerIssueInContext) {
    // Check if current message is a continuation of server issue discussion
    const continuationIndicators = [
      'still', 'not working', 'doesn\'t work', 'tried that', 'same issue',
      'nothing works', 'won\'t connect', 'can\'t get on', 'still down',
      'not fixed', 'same problem', 'getting worse', 'even worse'
    ];
    
    const currentContent = currentMessage.content.toLowerCase();
    const isContinuation = continuationIndicators.some(indicator => 
      currentContent.includes(indicator)
    );
    
    if (isContinuation) {
      console.log('Admin ping: Continuation of server issue conversation');
      return true;
    }
  }
  
  // Check if this conversation was already flagged as server-related
  if (conversationKey.includes('urgent') || conversationKey.includes('technical')) {
    // Look for existing bot response that had admin ping
    const existingResponse = botResponses.get(conversationKey);
    if (existingResponse && existingResponse.botMessage && 
        existingResponse.botMessage.content.includes('@&')) {
      console.log('Admin ping: Continuing conversation that already had admin ping');
      return true;
    }
  }
  
  return false;
}

// Helper function to determine if message needs professional response and personality to use
function analyzeMessageType(context) {
  if (!context || context.length === 0) {
    return { shouldRespond: false, personality: 'professional', responseType: 'none' };
  }

  const lastMessage = context[context.length - 1];
  if (!lastMessage || !lastMessage.content) {
    return { shouldRespond: false, personality: 'professional', responseType: 'none' };
  }

  const content = lastMessage.content.toLowerCase();
  
  // System/Help requests - always respond with professional personality
  const helpKeywords = ['help', 'please', 'how do', 'how to', 'what is', 'what are', 'explain', 'support'];
  const technicalIssueKeywords = ['down', 'broken', 'not working', 'offline', 'crashed', 'error', 'problem', 'issue', 'trouble', 'can\'t', 'cannot', 'won\'t', 'doesn\'t work'];
  
  // Direct questions - always respond professionally
  if (content.includes('?')) {
    console.log('AI responding professionally to direct question');
    return { shouldRespond: true, personality: 'professional', responseType: 'question' };
  }
  
  // Help requests - always respond professionally
  if (helpKeywords.some(keyword => content.includes(keyword))) {
    console.log('AI responding professionally to help request');
    return { shouldRespond: true, personality: 'professional', responseType: 'help' };
  }
  
  // Technical issues - always respond professionally
  if (technicalIssueKeywords.some(keyword => content.includes(keyword))) {
    console.log('AI responding professionally to technical issue');
    return { shouldRespond: true, personality: 'professional', responseType: 'technical' };
  }
  
  // Check for ongoing technical discussions, but only if current message could be related
  const recentContext = context.slice(-3).map(msg => msg.content.toLowerCase()).join(' ');
  const technicalKeywords = ['server', 'minecraft', 'game', 'connection', 'timeout', 'lag', 'bug', 'glitch'];
  
  // Check if current message suggests continuing technical discussion
  const currentMessageTechnical = technicalKeywords.some(keyword => content.includes(keyword));
  const followUpPatterns = [
    'i think', 'maybe', 'seems like', 'looks like', 'appears',
    'also', 'too', 'as well', 'same here', 'me too', 'still',
    'but', 'however', 'although', 'what about', 'tried that'
  ];
  
  // Only treat as ongoing technical if:
  // 1. Recent context has technical keywords AND
  // 2. Current message either has technical content OR suggests continuation
  const isFollowUpToTechnical = followUpPatterns.some(pattern => content.includes(pattern));
  
  if (technicalKeywords.some(keyword => recentContext.includes(keyword)) && 
      (currentMessageTechnical || isFollowUpToTechnical)) {
    console.log('AI responding professionally to ongoing technical discussion');
    return { shouldRespond: true, personality: 'professional', responseType: 'technical_ongoing' };
  }
  
  // Detect conversation topic changes that should reset to casual mode
  const topicChangeIndicators = [
    'anyway', 'btw', 'by the way', 'speaking of', 'on another note',
    'changing topics', 'different topic', 'off topic', 'random question',
    'good morning', 'good night', 'hello', 'hi everyone', 'hey guys',
    'what\'s up', 'how\'s everyone', 'how are you'
  ];
  
  const isTopicChange = topicChangeIndicators.some(indicator => content.includes(indicator));
  
  if (isTopicChange) {
    console.log('Conversation topic change detected - switching to casual mode');
    // For topic changes, use 10% chance for playful response
    const randomChance = Math.random();
    if (randomChance < 0.1) {
      console.log('AI randomly decided to respond playfully to topic change (10% chance triggered)');
      return { shouldRespond: true, personality: 'playful', responseType: 'topic_change_playful' };
    }
    return { shouldRespond: false, personality: 'professional', responseType: 'topic_change_ignored' };
  }
  
  // For casual/non-essential messages - 10% chance to respond playfully
  const randomChance = Math.random();
  if (randomChance < 0.1) { // 10% chance
    console.log('AI randomly decided to respond playfully (10% chance triggered)');
    return { shouldRespond: true, personality: 'playful', responseType: 'casual_random' };
  }
  
  // Default: don't respond to casual chat
  return { shouldRespond: false, personality: 'professional', responseType: 'casual_ignored' };
}

// Helper function to check if AI should respond (updated to use new analysis)
async function shouldAIRespond(context) {
  const config = getFreshConfig();
  const AI_SELF_FILTERING = config.aiSelfFiltering || { enabled: false };
  
  // If self-filtering is disabled, always respond with configured personality
  if (!AI_SELF_FILTERING.enabled) {
    return { shouldRespond: true, personality: AI_SELF_FILTERING.personalityLevel || 'professional', responseType: 'filtering_disabled' };
  }

  // Use new intelligent analysis
  const analysis = analyzeMessageType(context);
  
  // If we determined we should respond based on content analysis, return that
  if (analysis.shouldRespond) {
    return analysis;
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

    if (!filterResponse.ok) {
      console.error('AI filtering response not OK:', filterResponse.status, filterResponse.statusText);
      console.log('AI not reachable for filtering decision - staying silent');
      return { shouldRespond: false, personality: 'professional', responseType: 'ai_unavailable' };
    }

    const filterData = await filterResponse.json();
    const shouldRespond = filterData.choices?.[0]?.message?.content?.trim().toUpperCase() || filterData.choices?.[0]?.content?.trim().toUpperCase() || 'NO';
    
    console.log(`AI filtering decision: ${shouldRespond} for message context`);
    
    if (shouldRespond === 'YES') {
      // If AI thinks we should respond but our analysis didn't catch it, use professional tone
      return { shouldRespond: true, personality: 'professional', responseType: 'ai_filtered' };
    }
    
    return { shouldRespond: false, personality: 'professional', responseType: 'ai_declined' };
  } catch (err) {
    console.error('AI filtering error:', err);
    // If AI is not reachable, default to not responding (silent failure)
    console.log('AI not reachable for filtering decision - staying silent');
    return { shouldRespond: false, personality: 'professional', responseType: 'ai_error' };
  }
}

// Main message processing function (extracted from the event handler)
async function processMessage(message, conversationKey) {
  try {
    // Get fresh config for dynamic updates
    const config = getFreshConfig();
    const AI_SELF_FILTERING = config.aiSelfFiltering || { enabled: false };
    const ADMIN_ROLE_ID = config.adminRoles[0]; // Use the first admin role for server alerts
    
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
      if (serverResponse) {
        await sendOrEditResponse(message, serverResponse, true, ADMIN_ROLE_ID, conversationKey);
      } else {
        console.log('AI not reachable for server issue response - staying silent');
      }
      return;
    }

    // Check if AI should respond using self-filtering with intelligent personality selection
    let responseDecision = { shouldRespond: false, personality: 'professional', responseType: 'default' };
    
    if (AI_SELF_FILTERING.enabled) {
      responseDecision = await shouldAIRespond(context);
      if (!responseDecision.shouldRespond) {
        console.log(`AI decided not to respond to message: "${message.content.substring(0, 50)}..." (Reason: ${responseDecision.responseType})`);
        return;
      }
      console.log(`AI decided to respond with ${responseDecision.personality} personality (Reason: ${responseDecision.responseType})`);
    } else {
      // If filtering is disabled, use configured personality or default to professional
      responseDecision.shouldRespond = true;
      responseDecision.personality = AI_SELF_FILTERING.personalityLevel || 'professional';
      responseDecision.responseType = 'filtering_disabled';
    }

    // Check if this is a server issue that needs admin attention
    // Look at both current message and conversation context for server issues
    const needsAdminPing = shouldPingAdmin(message, context, conversationKey, AI_SELF_FILTERING);
    
    // Use the dynamically determined personality instead of config setting
    const personalityPrompt = getPersonalityPrompt(responseDecision.personality);
    
    let systemPrompt = `You are GameNight, a helpful assistant in the GameNight Discord server. You help with gaming issues, server problems, and technical support. Be concise, friendly, and natural in your responses. For technical issues, suggest simple troubleshooting steps users can try. Keep responses conversational and engaging. Focus on practical solutions and clear communication.${personalityPrompt}`;
    
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

    if (!aiResponse.ok) {
      console.error('AI response not OK:', aiResponse.status, aiResponse.statusText);
      return; // Silent failure if AI is not reachable
    }

    const data = await aiResponse.json();
    const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.content;
    
    if (!reply) {
      console.error('No valid response from AI');
      return; // Silent failure if AI doesn't provide a response
    }

    // Determine if we should send as a reply or regular message, and handle editing
    await sendOrEditResponse(message, reply, needsAdminPing, ADMIN_ROLE_ID, conversationKey);
    
  } catch (err) {
    console.error('LocalAI relay error:', err);
    // Check if we should fail silently or show an error message
    const config = getFreshConfig();
    const AI_SELF_FILTERING = config.aiSelfFiltering || { enabled: false };
    
    if (AI_SELF_FILTERING.silentFailureOnAIUnavailable) {
      console.log('AI not reachable - staying silent (silentFailureOnAIUnavailable = true)');
      return;
    } else {
      // Only send error as regular message, not reply
      await message.channel.send('There was an error contacting the AI.');
    }
  }
}

// Helper function to send or edit responses appropriately
async function sendOrEditResponse(originalMessage, reply, needsAdminPing, adminRoleId, conversationKey) {
  try {
    // Check if we already have a response for this conversation
    const existingResponseData = botResponses.get(conversationKey);
    
    let finalMessage;
    if (needsAdminPing) {
      finalMessage = `<@&${adminRoleId}> ${reply}`;
    } else {
      finalMessage = reply;
    }
    
    if (existingResponseData && existingResponseData.botMessage) {
      // Determine if we should edit or send new response
      const shouldSendNewResponse = shouldCreateNewResponse(originalMessage, existingResponseData, reply);
      
      if (!shouldSendNewResponse) {
        // Edit existing response
        try {
          await existingResponseData.botMessage.edit(finalMessage);
          console.log(`Edited existing response for conversation: ${conversationKey}`);
          
          // Update timestamp for future reference
          existingResponseData.timestamp = Date.now();
          return;
        } catch (editError) {
          console.error('Failed to edit message, sending new one:', editError.message);
          // Fall through to send new message
        }
      } else {
        console.log(`Sending new response (conversation evolved significantly)`);
        // Fall through to send new message
      }
    }
    
    // Determine whether to reply or just send to channel
    const shouldReply = needsAdminPing || originalMessage.content.includes('?') || 
                       originalMessage.content.toLowerCase().includes('help');
    
    let botMessage;
    if (shouldReply) {
      botMessage = await originalMessage.reply(finalMessage);
      console.log(`Sent reply for conversation: ${conversationKey}`);
    } else {
      botMessage = await originalMessage.channel.send(finalMessage);
      console.log(`Sent channel message for conversation: ${conversationKey}`);
    }
    
    // Store the bot response for potential editing later
    botResponses.set(conversationKey, {
      botMessage: botMessage,
      originalMessage: originalMessage,
      timestamp: Date.now(),
      responseCount: (existingResponseData?.responseCount || 0) + 1
    });
    
    // Clean up old responses (keep only last 50)
    if (botResponses.size > 50) {
      const oldestKey = Array.from(botResponses.keys())[0];
      botResponses.delete(oldestKey);
    }
    
  } catch (error) {
    console.error('Error sending/editing response:', error);
  }
}

// Helper function to determine if we should create a new response vs edit existing
function shouldCreateNewResponse(newMessage, existingResponseData, newReply) {
  const timeSinceLastResponse = Date.now() - existingResponseData.timestamp;
  const responseCount = existingResponseData.responseCount || 0;
  
  // Send new response if:
  
  // 1. It's been more than 5 minutes since last response
  if (timeSinceLastResponse > 5 * 60 * 1000) {
    console.log('Creating new response: 5+ minutes elapsed');
    return true;
  }
  
  // 2. We've already edited this response 2+ times
  if (responseCount >= 2) {
    console.log('Creating new response: already edited 2+ times');
    return true;
  }
  
  // 3. It's a different user asking a new question
  if (newMessage.author.id !== existingResponseData.originalMessage.author.id && 
      newMessage.content.includes('?')) {
    console.log('Creating new response: different user with question');
    return true;
  }
  
  // 4. The response content is significantly different (not just an update)
  const existingContent = existingResponseData.botMessage.content;
  const contentSimilarity = calculateContentSimilarity(existingContent, newReply);
  if (contentSimilarity < 0.6) { // Less than 60% similar
    console.log('Creating new response: content significantly different');
    return true;
  }
  
  // 5. New urgent issue detected
  const urgentKeywords = ['urgent', 'emergency', 'critical', 'now', 'immediately'];
  if (urgentKeywords.some(kw => newMessage.content.toLowerCase().includes(kw))) {
    console.log('Creating new response: urgent message detected');
    return true;
  }
  
  return false; // Default to editing
}

// Helper function to calculate content similarity (simple word overlap)
function calculateContentSimilarity(text1, text2) {
  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalUniqueWords = new Set([...words1, ...words2]).size;
  
  return commonWords.length / totalUniqueWords;
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || message.channel.id !== CHANNEL_ID) return;

    // Queue message for batched processing instead of immediate processing
    queueMessage(message);
  });
};
