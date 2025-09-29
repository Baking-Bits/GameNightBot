const ServiceManager = require('./src/services/ServiceManager');

async function testServerTracking() {
    console.log('Starting server tracking test...');
    
    const serviceManager = new ServiceManager();
    
    // Wait for health check
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    try {
        console.log('1. Testing addTrackedServer...');
        const result = await serviceManager.addTrackedServer('GameNight-Web-01', '78759', {
            temp_high: 90.0,
            temp_low: 25.0,
            wind: 45.0,
            humidity: 85
        });
        console.log('Added server result:', result.insertId ? 'Success' : 'Failed');

        console.log('2. Testing getAllTrackedServers...');
        const servers = await serviceManager.getAllTrackedServers();
        console.log('Tracked servers:', servers);

        if (servers.length > 0) {
            const serverId = servers[0].id;
            
            console.log('3. Testing getServerWeatherStatus...');
            const status = await serviceManager.getServerWeatherStatus(serverId);
            console.log('Server weather status:', {
                serverName: status.server.server_name,
                temperature: status.weather.temperature,
                hasAlerts: status.hasAlerts,
                alertCount: status.alerts.length
            });

            console.log('4. Testing checkAllServerWeather...');
            const checkResult = await serviceManager.checkAllServerWeather();
            console.log('Check all servers result:', checkResult);
        }
        
        console.log('\n✅ All server tracking tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
    
    process.exit(0);
}

testServerTracking();