const { Events } = require('discord.js');
const config = require('../../config.json');

const CHANNEL_ID = config.localAIChannelId;
const LOCALAI_URL = config.localAIUrl; // Should be v2 endpoint, e.g. http://localhost:8080/v2/chat/completions
const LOCALAI_MODEL = config.localAIModel;
const LOCALAI_API_KEY = config.localAIApiKey;

// Dynamic import for node-fetch (ESM in CommonJS)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

      const aiResponse = await fetch(LOCALAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOCALAI_API_KEY}`
        },
        body: JSON.stringify({
          model: LOCALAI_MODEL,
          messages: context
        })
      });

      const data = await aiResponse.json();
      const reply = data.choices?.[0]?.message?.content || data.choices?.[0]?.content || 'Sorry, I could not generate a response.';

      await message.reply(reply);
    } catch (err) {
      console.error('LocalAI relay error:', err);
      await message.reply('There was an error contacting the AI.');
    }
  });
};
