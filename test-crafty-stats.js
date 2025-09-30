const { craftyApiKey } = require('./config.json');

async function testCraftyStats() {
    try {
        const fetch = (await import('node-fetch')).default;
        const API_BASE_URL = 'https://crafty.gamenight.fun/api/v2';
        
        // First get servers
        const serversResponse = await fetch(`${API_BASE_URL}/servers`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${craftyApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        const serversData = await serversResponse.json();
        const servers = serversData.data || [];
        
        if (servers.length > 0) {
            const testServer = servers[0]; // Test with first server
            console.log(`Testing stats for server: ${testServer.server_name} (${testServer.server_id})`);
            
            // Test stats endpoint
            const statsResponse = await fetch(`${API_BASE_URL}/servers/${testServer.server_id}/stats`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${craftyApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!statsResponse.ok) {
                console.error(`Stats API error: ${statsResponse.status} ${statsResponse.statusText}`);
                return;
            }
            
            const stats = await statsResponse.json();
            console.log('Stats API response:');
            console.log(JSON.stringify(stats, null, 2));
            
            // Also test the alternative server status endpoint
            const statusResponse = await fetch(`${API_BASE_URL}/servers/${testServer.server_id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${craftyApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                console.log('\nServer details API response:');
                console.log(JSON.stringify(statusData, null, 2));
            }
        }
    } catch (error) {
        console.error('Error testing Crafty stats:', error);
    }
}

testCraftyStats();