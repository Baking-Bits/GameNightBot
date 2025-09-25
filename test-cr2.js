// Test specific UK postcode with OpenWeatherMap API
const axios = require('axios');

async function testUKPostcode() {
    const apiKey = 'a1afa3d523672a255ebd39a126e7ac3e';
    const postcode = 'CR2 7AR';
    
    console.log(`Testing UK postcode: ${postcode}`);
    
    // Try different API call formats
    const testUrls = [
        `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(postcode)},GB&appid=${apiKey}&units=imperial`,
        `http://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(postcode)}&appid=${apiKey}&units=imperial`,
        `http://api.openweathermap.org/data/2.5/weather?q=CR2+7AR,GB&appid=${apiKey}&units=imperial`,
        `http://api.openweathermap.org/data/2.5/weather?q=Croydon,GB&appid=${apiKey}&units=imperial`, // CR2 is Croydon area
    ];
    
    for (let i = 0; i < testUrls.length; i++) {
        console.log(`\n--- Test ${i + 1} ---`);
        console.log(`URL: ${testUrls[i].replace(apiKey, '[HIDDEN]')}`);
        
        try {
            const response = await axios.get(testUrls[i], { timeout: 10000 });
            console.log('✅ SUCCESS!');
            console.log(`Location: ${response.data.name}, ${response.data.sys.country}`);
            console.log(`Coordinates: ${response.data.coord.lat}, ${response.data.coord.lon}`);
            console.log(`Weather: ${response.data.weather[0].description}`);
            break; // Stop on first success
        } catch (error) {
            console.log('❌ FAILED');
            if (error.response) {
                console.log(`Status: ${error.response.status}`);
                console.log(`Error: ${error.response.data.message}`);
            } else {
                console.log(`Error: ${error.message}`);
            }
        }
    }
}

testUKPostcode();
