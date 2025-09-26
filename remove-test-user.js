// Remove the test user 670110851088384030 from weather data
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'services', 'data', 'weatherData.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const userId = '670110851088384030';

if (data.users[userId]) {
    console.log('Found user to remove:', {
        id: userId,
        displayName: data.users[userId].displayName,
        city: data.users[userId].city,
        postalCode: data.users[userId].postalCode
    });
    
    // Create backup first
    const backupPath = path.join(__dirname, 'services', 'data', 'backups', `weatherData_${new Date().toISOString().replace(/:/g, '-')}_remove-test-user.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    console.log('Created backup:', backupPath);
    
    // Remove the user
    delete data.users[userId];
    
    // Also remove from shittyWeatherScores if exists
    if (data.shittyWeatherScores && data.shittyWeatherScores[userId]) {
        delete data.shittyWeatherScores[userId];
        console.log('Also removed user from weather scores');
    }
    
    // Write updated data
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('Successfully removed user:', userId);
    
} else {
    console.log('User not found in weather data:', userId);
}
