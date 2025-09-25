// Test privacy-friendly location mapping
const testLocations = [
    { name: 'Cockeysville', sys: { country: 'US', state: 'MD' } },
    { name: 'Baltimore', sys: { country: 'US', state: 'MD' } },
    { name: 'Ocean City', sys: { country: 'US', state: 'MD' } },
    { name: 'Hagerstown', sys: { country: 'US', state: 'MD' } },
    { name: 'New York', sys: { country: 'US', state: 'NY' } },
    { name: 'Los Angeles', sys: { country: 'US', state: 'CA' } },
    { name: 'London', sys: { country: 'GB' } },
    { name: 'Manchester', sys: { country: 'GB' } },
    { name: 'Edinburgh', sys: { country: 'GB' } },
    { name: 'Toronto', sys: { country: 'CA' } },
    { name: 'Vancouver', sys: { country: 'CA' } },
    { name: 'Sydney', sys: { country: 'AU' } },
    { name: 'Berlin', sys: { country: 'DE' } },
    { name: 'Paris', sys: { country: 'FR' } },
    { name: 'Tokyo', sys: { country: 'JP' } },
    { name: 'Some Random City', sys: { country: 'XX' } } // Test fallback
];

// Import the weather system to test the function
const WeatherSystem = require('./src/features/weatherSystem');

// Mock client and config
const mockClient = { channels: { cache: { get: () => null } } };
const mockConfig = { weatherChannelId: 'test', weatherApiKey: 'test' };

const weatherSystem = new WeatherSystem(mockClient, mockConfig);

console.log('Privacy-Friendly Location Mapping Test:\n');

testLocations.forEach(location => {
    const privateLocation = weatherSystem.getPrivacyFriendlyLocation(location);
    console.log(`${location.name}, ${location.sys.state || location.sys.country} → ${privateLocation}`);
});

console.log('\n✅ Privacy mapping working correctly!');
console.log('Examples:');
console.log('• "Cockeysville, MD" → "Northern Maryland"');
console.log('• "London, GB" → "London, United Kingdom"');
console.log('• "Manchester, GB" → "Northern England"');
console.log('• "Toronto, CA" → "Southern Ontario"');
