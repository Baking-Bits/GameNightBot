// Fix the undefined user in weather data
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'services', 'data', 'weatherData.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Find and fix the user with no displayName
const userId = '670110851088384030';
if (data.users[userId] && !data.users[userId].displayName) {
    console.log('Found user without displayName:', userId);
    console.log('Current data:', data.users[userId]);
    
    // Update the display name
    data.users[userId].displayName = 'Test User'; // You can change this if you know the actual display name
    data.users[userId].updatedAt = new Date().toISOString();
    
    // Create backup first
    const backupPath = path.join(__dirname, 'services', 'data', 'backups', `weatherData_${new Date().toISOString().replace(/:/g, '-')}_fix-undefined-user.json`);
    fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
    console.log('Created backup:', backupPath);
    
    // Write updated data
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    console.log('Fixed user displayName!');
    console.log('Updated data:', data.users[userId]);
} else {
    console.log('User not found or already has displayName');
}
