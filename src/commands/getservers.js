const { craftyApiKey } = require('../../config.json');
let fetch;
(async () => {
  fetch = (await import('node-fetch')).default;
})();

module.exports = {
  data: {
    name: 'getallservers',
    description: 'Fetches all servers from CraftyControl',
    default_member_permissions: 8 // ADMINISTRATOR
  },
  async execute(interaction, bot) {
    try {
      const response = await fetch('https://mc.gamenight.fun:8443/api/v2/servers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${craftyApiKey}`,
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