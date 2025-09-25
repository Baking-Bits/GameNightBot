const axios = require('axios');

async function testOpenWeatherAPI() {
    const apiKey = 'a1afa3d523672a255ebd39a126e7ac3e';
    const zipCode = '10001';
    const url = `http://api.openweathermap.org/data/2.5/weather?zip=${zipCode}&appid=${apiKey}&units=imperial`;
    
    console.log('Testing OpenWeatherMap API...');
    console.log('URL:', url.replace(apiKey, '[HIDDEN]'));
    
    try {
        const response = await axios.get(url, { timeout: 10000 });
        console.log('✅ API call successful!');
        console.log('Response data:', {
            name: response.data.name,
            country: response.data.sys.country,
            temp: response.data.main.temp,
            description: response.data.weather[0].description
        });
    } catch (error) {
        console.error('❌ API call failed:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testOpenWeatherAPI();
