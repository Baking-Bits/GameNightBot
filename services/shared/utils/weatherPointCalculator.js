// Point calculation utility for weather conditions
// This function calculates points based on weather data and returns detailed breakdown

function calculateWeatherPoints(weatherData) {
    if (!weatherData || !weatherData.main) {
        return { points: 0, breakdown: {}, summary: 'No weather data available' };
    }

    let points = 0;
    const breakdown = {};
    const summaryParts = [];
    
    // Extract weather data
    const temp = weatherData.main.temp || 70;
    const humidity = weatherData.main.humidity || 50;
    const windSpeed = (weatherData.wind?.speed || 0) * 2.237; // Convert m/s to mph
    const condition = weatherData.weather?.[0]?.main?.toLowerCase() || '';
    const description = weatherData.weather?.[0]?.description || '';
    
    // Temperature-based points
    if (temp > 95) { 
        breakdown.extreme_heat = 3; 
        points += 3;
        summaryParts.push('extreme heat');
    } else if (temp > 85) { 
        breakdown.hot = 1; 
        points += 1;
        summaryParts.push('hot weather');
    } else if (temp < 20) { 
        breakdown.extreme_cold = 3; 
        points += 3;
        summaryParts.push('extreme cold');
    } else if (temp < 32) { 
        breakdown.freezing = 2; 
        points += 2;
        summaryParts.push('freezing');
    } else if (temp < 40) { 
        breakdown.cold = 1; 
        points += 1;
        summaryParts.push('cold');
    }
    
    // Precipitation-based points
    if (condition.includes('thunderstorm')) {
        breakdown.thunderstorm = 4;
        points += 4;
        summaryParts.push('thunderstorm');
    } else if (condition.includes('snow')) {
        breakdown.snow = 3;
        points += 3;
        summaryParts.push('snow');
    } else if (condition.includes('rain')) {
        breakdown.rain = 2;
        points += 2;
        summaryParts.push('rain');
    } else if (condition.includes('drizzle')) {
        breakdown.drizzle = 1;
        points += 1;
        summaryParts.push('drizzle');
    }
    
    // Wind-based points
    if (windSpeed > 25) { 
        breakdown.high_winds = 3; 
        points += 3;
        summaryParts.push('high winds');
    } else if (windSpeed > 15) { 
        breakdown.moderate_winds = 1; 
        points += 1;
        summaryParts.push('moderate winds');
    }
    
    // Humidity-based points (very high or very low)
    if (humidity > 85) { 
        breakdown.high_humidity = 1; 
        points += 1;
        summaryParts.push('high humidity');
    } else if (humidity < 20) { 
        breakdown.low_humidity = 1; 
        points += 1;
        summaryParts.push('low humidity');
    }
    
    // Special conditions
    if (description.includes('fog') || description.includes('mist')) {
        breakdown.poor_visibility = 1;
        points += 1;
        summaryParts.push('poor visibility');
    }
    if (description.includes('tornado')) {
        breakdown.tornado = 10;
        points += 10;
        summaryParts.push('TORNADO');
    }
    if (description.includes('hurricane')) {
        breakdown.hurricane = 8;
        points += 8;
        summaryParts.push('HURRICANE');
    }
    if (description.includes('blizzard')) {
        breakdown.blizzard = 5;
        points += 5;
        summaryParts.push('blizzard');
    }
    
    // Create summary
    let summary = description;
    if (summaryParts.length > 0) {
        summary += ` (${summaryParts.join(', ')})`;
    }
    
    return {
        points,
        breakdown,
        summary,
        rawData: {
            temperature: temp,
            humidity,
            windSpeed,
            condition,
            description
        }
    };
}

module.exports = { calculateWeatherPoints };