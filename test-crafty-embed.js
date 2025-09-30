// Test the Crafty command logic
const { EmbedBuilder } = require('discord.js');

// Mock data from the API response
const servers = [
    {
        "server_id": "e34da69b-39b3-4c9b-99e1-8d3edbb7541a",
        "server_name": "Velocity 3.4.0",
        "server_ip": "127.0.0.1",
        "server_port": 25565,
        "type": "minecraft-java",
        "show_status": true,
        "auto_start": true
    },
    {
        "server_id": "d81de5fc-c229-4b76-9316-1a144193531e",
        "server_name": "Paper - Lobby",
        "server_ip": "127.0.0.1",
        "server_port": 25566,
        "type": "minecraft-java",
        "show_status": true,
        "auto_start": true
    },
    {
        "server_id": "b0a89126-ef6f-4bd7-a219-70c3f01c38ca",
        "server_name": "Survival - Paper 1.21.4",
        "server_ip": "127.0.0.1",
        "server_port": 25565,
        "type": "minecraft-java",
        "show_status": true,
        "auto_start": true
    }
];

function testEmbedCreation() {
    try {
        const embed = new EmbedBuilder()
            .setTitle('🖥️ CraftyControl Server Dashboard')
            .setColor('#4CAF50')
            .setTimestamp();

        const onlineServers = servers.filter(s => s.show_status).length;
        const totalServers = servers.length;
        
        embed.setDescription(
            `**${onlineServers}/${totalServers} servers online**\n\n` +
            '**Admin Access:** Select a server below for management options'
        );

        // Create compact server list
        const serverItems = servers.map(server => {
            const statusIcon = server.show_status ? '🟢' : '🔴';
            return `${statusIcon} **${server.server_name}** (${server.server_ip}:${server.server_port})`;
        });

        const chunkSize = 5;
        const serverChunks = [];
        for (let i = 0; i < serverItems.length; i += chunkSize) {
            serverChunks.push(serverItems.slice(i, i + chunkSize));
        }

        serverChunks.forEach((chunk, index) => {
            const fieldName = serverChunks.length > 1 ? 
                `🖥️ Servers (${index * chunkSize + 1}-${Math.min((index + 1) * chunkSize, servers.length)})` : 
                '🖥️ All Servers';
            
            embed.addFields({
                name: fieldName,
                value: chunk.join('\n'),
                inline: false
            });
        });

        console.log('Embed created successfully!');
        console.log('Title:', embed.data.title);
        console.log('Description:', embed.data.description);
        console.log('Fields:');
        embed.data.fields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field.name} (${field.value.length} chars)`);
            console.log(`     "${field.value}"`);
        });
        
        return true;
    } catch (error) {
        console.error('Error creating embed:', error);
        return false;
    }
}

console.log('Testing Crafty embed creation...');
testEmbedCreation();