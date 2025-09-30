const API_BASE_URL = 'https://crafty.gamenight.fun/api/v2';
const craftyApiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJpYXQiOjE3NTkxOTE3MDcsInRva2VuX2lkIjoxfQ.hNXL7RrzHkjK-SpIY3UmKkp94PKHUa6YcqzJysL_5-8';

async function testCraftyAPI() {
    try {
        console.log('Testing Crafty API connection...');
        
        // Dynamic import for node-fetch
        const fetch = (await import('node-fetch')).default;
        
        const response = await fetch(`${API_BASE_URL}/servers`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${craftyApiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Response status:', response.status);
        console.log('Response statusText:', response.statusText);
        
        if (!response.ok) {
            console.error('API Error:', response.statusText);
            const errorText = await response.text();
            console.error('Error details:', errorText);
            return;
        }
        
        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));
        
    } catch (error) {
        console.error('Connection error:', error.message);
    }
}

testCraftyAPI();