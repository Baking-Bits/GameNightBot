const fetch = require('node-fetch');

module.exports = {
  data: {
    name: 'getallservers',
    description: 'Fetches all servers from CraftyControl',
    default_member_permissions: 8 // ADMINISTRATOR
  },
  async execute(interaction, bot) {
    const apiKey = bot.config.craftyApiKey; // Assuming the API key is stored in the bot's config

    try {
      const response = await fetch('https://api.craftycontrol.com/v2/servers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching servers: ${response.statusText}`);
      }

      const servers = await response.json();
      const serverList = servers.map(server => `${server.name} (ID: ${server.id})`).join('\n');

      await interaction.reply({ content: `Servers:\n${serverList}`, ephemeral: true });
    } catch (error) {
      console.error('Error fetching servers:', error);
      await interaction.reply({ content: `There was an error fetching the servers: ${error.message}`, ephemeral: true });
    }
  },
};