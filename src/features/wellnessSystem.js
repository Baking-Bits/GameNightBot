const { EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const { getPersonalities } = require('../utils/personalities');

// Dynamic import for fetch if not available globally (Node.js < 18)
let fetch;
(async () => {
    if (typeof globalThis.fetch === 'undefined') {
        const { default: nodeFetch } = await import('node-fetch');
        fetch = nodeFetch;
    } else {
        fetch = globalThis.fetch;
    }
})();

class WellnessSystem {
    constructor(client, config) {
        this.client = client;
        this.config = config;
        this.dataDir = path.join(__dirname, '../../data');
        this.mealHistoryPath = path.join(this.dataDir, 'mealHistory.json');
        this.workoutHistoryPath = path.join(this.dataDir, 'workoutHistory.json');
        this.snackHistoryPath = path.join(this.dataDir, 'snackHistory.json');
        this.scheduledJobs = new Map();
        this.scheduleEnabled = true;
        this.responseTimeStats = {
            recent: [], // Last 20 response times with timestamps and types
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0
        };
    }

    async callLocalAI(messages, personality, channel = null, maxTokens = 500, timeoutMs = 30000) {
        const startTime = Date.now();
        try {
            console.log(`[ADMIN] Making LocalAI call for personality: ${personality}`);
            
            const personalities = getPersonalities();
            const personalityPrompt = personalities[personality]?.systemPrompt || '';
            
            // Build the message array with system prompt
            const systemMessage = {
                role: 'system',
                content: `You are a helpful AI assistant.${personalityPrompt}`
            };
            
            const requestMessages = [systemMessage, ...messages];
            
            console.log(`[ADMIN] Sending request to: ${this.config.localAIUrl}`);
            console.log(`[ADMIN] Model: ${this.config.localAIModel}`);
            console.log(`[ADMIN] Messages count: ${requestMessages.length}`);
            console.log(`[ADMIN] Timeout: ${timeoutMs / 1000} seconds (${(timeoutMs / 60000).toFixed(1)} minutes)`);
            
            // Create AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const response = await fetch(this.config.localAIUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.localAIApiKey || 'sk-no-key-required'}`
                },
                body: JSON.stringify({
                    model: this.config.localAIModel,
                    messages: requestMessages,
                    max_tokens: maxTokens,
                    temperature: 0.7
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            
            const responseTime = Date.now() - startTime;
            console.log(`[ADMIN] Response status: ${response.status}`);
            console.log(`[ADMIN] ⏱️ Response Time: ${responseTime}ms (${(responseTime / 1000).toFixed(1)}s)`);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`AI API error response: ${errorText}`);
                throw new Error(`AI API request failed: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('[ADMIN] Response received successfully');
            
            const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.content;
            
            if (!content) {
                console.error('[ADMIN] No content in response:', data);
                throw new Error('No content in response');
            }
            
            console.log(`[ADMIN] Response content length: ${content.length}`);
            return { content, responseTimeMs: responseTime };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            if (error.name === 'AbortError') {
                console.error(`[ADMIN] ❌ Request timed out after ${timeoutMs / 1000} seconds (${responseTime}ms elapsed)`);
                throw new Error('Request timed out');
            }
            console.error(`[ADMIN] ❌ Error calling service after ${responseTime}ms:`, error);
            throw error;
        }
    }

    async initializeDataFiles() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Initialize history files if they don't exist
            const files = [
                { path: this.mealHistoryPath, data: { meals: [], lastGenerated: null } },
                { path: this.workoutHistoryPath, data: { workouts: [], lastGenerated: null } },
                { path: this.snackHistoryPath, data: { snacks: [], lastGenerated: null } }
            ];

            for (const file of files) {
                try {
                    await fs.access(file.path);
                } catch {
                    await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
                }
            }
        } catch (error) {
            console.error('Failed to initialize meal plan data files:', error);
        }
    }

    async loadHistory(type) {
        const filePath = type === 'meal' ? this.mealHistoryPath :
                        type === 'workout' ? this.workoutHistoryPath :
                        this.snackHistoryPath;
        
        try {
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error(`Failed to load ${type} history:`, error);
            return { [type + 's']: [], lastGenerated: null };
        }
    }

    async saveHistory(type, data) {
        const filePath = type === 'meal' ? this.mealHistoryPath :
                        type === 'workout' ? this.workoutHistoryPath :
                        this.snackHistoryPath;
        
        try {
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error(`Failed to save ${type} history:`, error);
        }
    }

    generatePrompt(type, history, timeOfDay = null, requirements = null) {
        const personalities = getPersonalities();
        const nutritionistPersonality = personalities.nutritionist;
        
        const recentItems = history[type + 's'].slice(-14); // Last 2 weeks
        const recentNames = recentItems.map(item => item.name);
        
        const basePrompt = `${nutritionistPersonality.systemPrompt}\n\n`;
        
        let specificPrompt = '';
        
        if (type === 'meal') {
            const mealTime = this.getMealTimeFromHour(timeOfDay);
            specificPrompt = `Generate a ${mealTime} meal plan. Requirements:
- Must be different from recent meals: ${recentNames.join(', ')}
- Appropriate for ${mealTime} (lighter for breakfast, heartier for dinner)
- Include seasonal ingredients when possible
- Consider nutritional balance for active lifestyles
- Prep time should be reasonable for the meal time
- Budget-friendly ingredients when possible${requirements ? `\n- SPECIAL REQUEST: ${requirements}` : ''}

Response format (valid JSON only):
{
  "name": "Meal name",
  "type": "${mealTime}",
  "ingredients": ["ingredient1", "ingredient2"],
  "prepTime": "XX minutes",
  "calories": "XXX-XXX",
  "description": "Brief appetizing description",
  "instructions": ["step1", "step2", "step3"],
  "nutritionNotes": "Key nutritional benefits"
}`;
        } else if (type === 'snack') {
            specificPrompt = `Generate a healthy snack idea. Requirements:
- Must be different from recent snacks: ${recentNames.join(', ')}
- Easy to eat and portable
- Nutritious and energy-sustaining
- Quick to prepare (under 10 minutes)
- Suitable for busy schedules${requirements ? `\n- SPECIAL REQUEST: ${requirements}` : ''}

Response format (valid JSON only):
{
  "name": "Snack name",
  "type": "snack",
  "ingredients": ["ingredient1", "ingredient2"],
  "prepTime": "X minutes",
  "calories": "XXX",
  "description": "Brief description",
  "instructions": ["step1", "step2"],
  "benefits": "Why this snack is good for sustained energy"
}`;
        } else if (type === 'workout') {
            const workoutTime = timeOfDay && timeOfDay < 12 ? 'morning' : 'evening';
            const intensity = workoutTime === 'morning' ? 'light to moderate' : 'moderate to intense';
            
            specificPrompt = `Generate a ${workoutTime} workout routine. Requirements:
- Must be different from recent workouts: ${recentNames.join(', ')}
- ${intensity} intensity appropriate for ${workoutTime}
- Suitable for desk workers (address posture, flexibility, strength)
- 15-30 minutes duration
- Can be done at home with minimal equipment${requirements ? `\n- SPECIAL REQUEST: ${requirements}` : ''}

Response format (valid JSON only):
{
  "name": "Workout name",
  "type": "${workoutTime}",
  "duration": "XX minutes",
  "intensity": "${intensity}",
  "equipment": ["equipment1", "bodyweight"],
  "description": "Brief motivating description",
  "exercises": [
    {"name": "Exercise 1", "sets": "3", "reps": "10-15", "description": "How to perform"},
    {"name": "Exercise 2", "duration": "30 seconds", "description": "How to perform"}
  ],
  "healthBenefits": "How this helps with posture, flexibility, and overall health"
}`;
        }

        return basePrompt + specificPrompt;
    }

    getMealTimeFromHour(hour) {
        if (hour >= 5 && hour < 11) return 'breakfast';
        if (hour >= 11 && hour < 16) return 'lunch';
        return 'dinner';
    }

    async generateContent(type, timeOfDay = null, requirements = null) {
        const startTime = Date.now();
        try {
            console.log(`[ADMIN] Generating ${type} content${requirements ? ` with requirements: ${requirements}` : ''}...`);
            const history = await this.loadHistory(type);
            const prompt = this.generatePrompt(type, history, timeOfDay, requirements);
            
            // Set timeout based on content type - all meal plan requests get 10 minutes
            let timeoutMs;
            switch (type) {
                case 'meal':
                    timeoutMs = 10 * 60 * 1000; // 10 minutes for meals
                    break;
                case 'workout':
                    timeoutMs = 10 * 60 * 1000; // 10 minutes for workouts
                    break;
                case 'snack':
                    timeoutMs = 10 * 60 * 1000; // 10 minutes for snacks
                    break;
                default:
                    timeoutMs = 30 * 1000; // 30 seconds default
            }
            
            const response = await this.callLocalAI([
                { role: 'user', content: prompt }
            ], 'nutritionist', null, 500, timeoutMs);

            if (!response || !response.content) {
                throw new Error('No response from AI');
            }

            // Try to parse JSON response
            let contentData;
            try {
                let jsonText = response.content;
                
                // Remove markdown code blocks if present
                jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                
                // Try to find JSON object in the response
                const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    // Get the last complete JSON object (in case there are multiple)
                    let jsonStr = jsonMatch[0];
                    
                    // Handle truncated JSON by finding the last complete object
                    let braceCount = 0;
                    let lastCompleteIndex = -1;
                    
                    for (let i = 0; i < jsonStr.length; i++) {
                        if (jsonStr[i] === '{') braceCount++;
                        if (jsonStr[i] === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                lastCompleteIndex = i;
                            }
                        }
                    }
                    
                    if (lastCompleteIndex > -1) {
                        jsonStr = jsonStr.substring(0, lastCompleteIndex + 1);
                    }
                    
                    contentData = JSON.parse(jsonStr);
                    console.log('[ADMIN] Successfully parsed JSON response');
                } else {
                    throw new Error('No JSON found in response');
                }
            } catch (parseError) {
                console.error('[ADMIN] Failed to parse response as JSON:', parseError);
                console.log('[ADMIN] Response was:', response.content.substring(0, 500) + '...');
                throw new Error('Invalid JSON response from service');
            }

            // Add metadata including response time
            contentData.generatedAt = new Date().toISOString();
            contentData.id = Date.now().toString();
            contentData.isAIGenerated = true; // Mark as AI-generated content
            contentData.responseTimeMs = response.responseTimeMs;

            // Record response time for admin tracking
            this.recordResponseTime(type, response.responseTimeMs, true);

            console.log(`[ADMIN] ✅ Successfully generated ${type}: ${contentData.name} (Response time: ${response.responseTimeMs}ms / ${(response.responseTimeMs / 1000).toFixed(1)}s)`);

            // Save to history
            const key = type + 's';
            history[key].push(contentData);
            
            // Keep only last 30 items
            if (history[key].length > 30) {
                history[key] = history[key].slice(-30);
            }
            
            history.lastGenerated = new Date().toISOString();
            await this.saveHistory(type, history);

            return contentData;
        } catch (error) {
            const responseTime = Date.now() - startTime;
            this.recordResponseTime(type, responseTime, false);
            console.error(`[ADMIN] ❌ Failed to generate ${type} after ${responseTime}ms:`, error);
            
            // Record failed response time
            this.recordResponseTime(type, responseTime, false);
            
            // Return fallback content
            return this.getFallbackContent(type);
        }
    }

    getFallbackContent(type) {
        console.log(`[ADMIN] 📋 Providing fallback ${type} content (Service unavailable)`);
        
        const fallbacks = {
            meal: {
                name: "Quick Healthy Meal",
                type: "fallback",
                prepTime: "15 minutes",
                calories: "400-500",
                ingredients: ["pasta", "canned sauce", "cheese", "mixed vegetables"],
                description: "A simple, nutritious meal perfect for busy schedules",
                instructions: ["Cook pasta according to package directions", "Heat sauce in pan", "Mix pasta and sauce", "Add cheese and vegetables", "Serve hot"],
                nutritionNotes: "Provides carbohydrates for energy, protein from cheese, and vitamins from vegetables",
                generatedAt: new Date().toISOString(),
                id: Date.now().toString(),
                isAIGenerated: false, // Mark as fallback content
                responseTimeMs: 0 // No AI response time for fallback
            },
            snack: {
                name: "Energy Trail Mix",
                type: "fallback",
                prepTime: "5 minutes",
                calories: "200-250",
                ingredients: ["mixed nuts", "dried fruit", "dark chocolate chips"],
                description: "Perfect snack for sustained energy throughout the day",
                instructions: ["Mix nuts and dried fruit in bowl", "Add chocolate chips", "Store in container for easy access"],
                benefits: "Provides healthy fats, natural sugars, and antioxidants for sustained energy",
                generatedAt: new Date().toISOString(),
                id: Date.now().toString(),
                isAIGenerated: false, // Mark as fallback content
                responseTimeMs: 0 // No AI response time for fallback
            },
            workout: {
                name: "Quick Desk Break Workout",
                type: "fallback",
                duration: "10 minutes",
                intensity: "Low",
                equipment: ["bodyweight"],
                description: "Simple exercises to combat the effects of prolonged sitting",
                exercises: [
                    {"name": "Neck Rolls", "duration": "30 seconds", "description": "Gently roll neck in circles to relieve tension"},
                    {"name": "Shoulder Shrugs", "sets": "2", "reps": "10", "description": "Lift shoulders up and back down to release upper body tension"},
                    {"name": "Wrist Circles", "duration": "30 seconds", "description": "Rotate wrists clockwise and counterclockwise"},
                    {"name": "Seated Spinal Twist", "sets": "2", "reps": "5 each side", "description": "Twist gently left and right to improve spine mobility"}
                ],
                healthBenefits: "Improves posture, reduces muscle tension, and increases flexibility for desk workers",
                generatedAt: new Date().toISOString(),
                id: Date.now().toString(),
                isAIGenerated: false, // Mark as fallback content
                responseTimeMs: 0 // No AI response time for fallback
            }
        };
        
        return fallbacks[type] || fallbacks.meal;
    }

    createEmbed(type, data, requirements = null) {
        const embed = new EmbedBuilder();
        
        // Add personalized message based on requirements
        let personalizedDescription = data.description;
        if (requirements) {
            let requirementMessage = '';
            if (type === 'meal') {
                requirementMessage = `Based on your request for "${requirements}", here's what I recommend:\n\n`;
            } else if (type === 'snack') {
                requirementMessage = `Since you wanted "${requirements}", here's a perfect snack option:\n\n`;
            } else if (type === 'workout') {
                requirementMessage = `Based on your interest in "${requirements}", here's what I suggest:\n\n`;
            }
            personalizedDescription = requirementMessage + data.description;
        }
        
        if (type === 'meal') {
            embed
                .setTitle(`🍽️ ${data.name}`)
                .setDescription(personalizedDescription)
                .setColor(data.type === 'breakfast' ? 0xFFD700 : 
                         data.type === 'lunch' ? 0xFF8C00 : 0xFF4500)
                .addFields(
                    { name: '🥘 Type', value: data.type.charAt(0).toUpperCase() + data.type.slice(1), inline: true },
                    { name: '⏱️ Prep Time', value: data.prepTime, inline: true },
                    { name: '🔥 Calories', value: data.calories, inline: true },
                    { name: '🛒 Ingredients', value: data.ingredients.join('\n• '), inline: false },
                    { name: '👨‍🍳 Instructions', value: data.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n'), inline: false }
                );
                
            if (data.nutritionNotes) {
                embed.addFields({ name: '💪 Nutrition Notes', value: data.nutritionNotes, inline: false });
            }
        } else if (type === 'snack') {
            embed
                .setTitle(`🍿 ${data.name}`)
                .setDescription(personalizedDescription)
                .setColor(0x32CD32)
                .addFields(
                    { name: '⏱️ Prep Time', value: data.prepTime, inline: true },
                    { name: '🔥 Calories', value: data.calories, inline: true },
                    { name: '🛒 Ingredients', value: data.ingredients.join('\n• '), inline: false },
                    { name: '👨‍🍳 Instructions', value: data.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n'), inline: false },
                    { name: '⚡ Benefits', value: data.benefits, inline: false }
                );
        } else if (type === 'workout') {
            embed
                .setTitle(`💪 ${data.name}`)
                .setDescription(personalizedDescription)
                .setColor(data.type === 'morning' ? 0x87CEEB : 0x4169E1)
                .addFields(
                    { name: '⏱️ Duration', value: data.duration, inline: true },
                    { name: '🔥 Intensity', value: data.intensity, inline: true },
                    { name: '🏋️ Equipment', value: data.equipment.join(', '), inline: true }
                );

            if (data.exercises && data.exercises.length > 0) {
                const exerciseText = data.exercises.map(ex => {
                    const reps = ex.reps ? `${ex.sets} sets × ${ex.reps} reps` : 
                                ex.duration ? ex.duration : 'As prescribed';
                    return `**${ex.name}** (${reps})\n${ex.description}`;
                }).join('\n\n');
                
                embed.addFields({ name: '🏃‍♂️ Exercises', value: exerciseText, inline: false });
            }

            if (data.healthBenefits) {
                embed.addFields({ name: '💪 Health Benefits', value: data.healthBenefits, inline: false });
            }
            if (data.gamerBenefits) {
                embed.addFields({ name: '🎮 Gamer Benefits', value: data.gamerBenefits, inline: false });
            }
        }

        // Simple timestamp footer - no AI information exposed to users
        const generatedDate = new Date(data.generatedAt);
        const easternTime = generatedDate.toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        // Only show fallback indicator if it's fallback content
        let footerText = `Generated at ${easternTime}`;
        if (!data.isAIGenerated) {
            footerText = `📋 • ${footerText}`;
        } else if (data.responseTimeMs) {
            const responseTimeSeconds = (data.responseTimeMs / 1000).toFixed(1);
            footerText = `🤖 AI Generated (${responseTimeSeconds}s) • ${footerText}`;
        }
        embed.setFooter({ text: footerText });
        return embed;
    }

    async postToChannel(type, channelId, data, requirements = null) {
        try {
            const channel = await this.client.channels.fetch(channelId);
            if (!channel) {
                throw new Error('Channel not found');
            }

            const embed = this.createEmbed(type, data, requirements);
            await channel.send({ embeds: [embed] });
            
            console.log(`[ADMIN] Posted ${type} to channel ${channelId}: ${data.name}${requirements ? ` (with requirements: ${requirements})` : ''}${data.isAIGenerated ? '' : ' [FALLBACK]'}`);
        } catch (error) {
            console.error(`Failed to post ${type} to channel:`, error);
        }
    }

    async initialize() {
        await this.initializeDataFiles();
        await this.setupSchedules();
    }

    async setupSchedules() {
        // Clear existing jobs
        this.scheduledJobs.forEach(job => job.destroy());
        this.scheduledJobs.clear();

        try {
            if (!this.config.wellnessChannelId || !this.config.wellnessSchedule) {
                console.log('Wellness system not configured, skipping schedule setup');
                return;
            }

            const schedule = this.config.wellnessSchedule;
            const channelId = this.config.wellnessChannelId;

            // Schedule meals
            if (schedule.meals && Array.isArray(schedule.meals)) {
                schedule.meals.forEach((mealTime, index) => {
                    const job = cron.schedule(this.timeToCron(mealTime), async () => {
                        if (!this.scheduleEnabled) return;
                        try {
                            const hour = parseInt(mealTime.split(':')[0]);
                            const meal = await this.generateContent('meal', hour);
                            await this.postToChannel('meal', channelId, meal);
                        } catch (error) {
                            console.error('Failed to generate/post meal:', error);
                        }
                    }, { 
                        scheduled: false,
                        timezone: 'America/New_York'
                    });
                    this.scheduledJobs.set(`meal_${index}`, job);
                });
            }

            // Schedule snacks
            if (schedule.snacks && Array.isArray(schedule.snacks)) {
                schedule.snacks.forEach((snackTime, index) => {
                    const job = cron.schedule(this.timeToCron(snackTime), async () => {
                        if (!this.scheduleEnabled) return;
                        try {
                            const snack = await this.generateContent('snack');
                            await this.postToChannel('snack', channelId, snack);
                        } catch (error) {
                            console.error('Failed to generate/post snack:', error);
                        }
                    }, { 
                        scheduled: false,
                        timezone: 'America/New_York'
                    });
                    this.scheduledJobs.set(`snack_${index}`, job);
                });
            }

            // Schedule workouts
            if (schedule.workouts && Array.isArray(schedule.workouts)) {
                schedule.workouts.forEach((workoutTime, index) => {
                    const job = cron.schedule(this.timeToCron(workoutTime), async () => {
                        if (!this.scheduleEnabled) return;
                        try {
                            const hour = parseInt(workoutTime.split(':')[0]);
                            const workout = await this.generateContent('workout', hour);
                            await this.postToChannel('workout', channelId, workout);
                        } catch (error) {
                            console.error('Failed to generate/post workout:', error);
                        }
                    }, { 
                        scheduled: false,
                        timezone: 'America/New_York'
                    });
                    this.scheduledJobs.set(`workout_${index}`, job);
                });
            }

            // Start all jobs
            this.scheduledJobs.forEach(job => job.start());
            
            console.log(`Set up ${this.scheduledJobs.size} meal plan schedules (America/New_York timezone)`);
        } catch (error) {
            console.error('Failed to setup meal plan schedules:', error);
        }
    }

    timeToCron(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return `${minutes} ${hours} * * *`; // Every day at the specified time
    }

    async reloadSchedules() {
        await this.setupSchedules();
    }

    toggleSchedule() {
        this.scheduleEnabled = !this.scheduleEnabled;
        console.log(`Meal plan schedule ${this.scheduleEnabled ? 'enabled' : 'disabled'}`);
        return this.scheduleEnabled;
    }

    async generateMeal(requirements = null) {
        const hour = new Date().getHours();
        const data = await this.generateContent('meal', hour, requirements);
        return {
            data,
            embed: this.createEmbed('meal', data, requirements)
        };
    }

    async generateSnack(requirements = null) {
        const data = await this.generateContent('snack', null, requirements);
        return {
            data,
            embed: this.createEmbed('snack', data, requirements)
        };
    }

    async generateWorkout(requirements = null) {
        const hour = new Date().getHours();
        const data = await this.generateContent('workout', hour, requirements);
        return {
            data,
            embed: this.createEmbed('workout', data, requirements)
        };
    }

    async getHistory(type, limit = 10) {
        const history = await this.loadHistory(type);
        const items = history[type + 's'] || [];
        return items.slice(-limit).reverse(); // Most recent first
    }

    async clearHistory(type) {
        const emptyHistory = { [type + 's']: [], lastGenerated: null };
        await this.saveHistory(type, emptyHistory);
    }

    // Response time tracking methods
    recordResponseTime(type, responseTimeMs, success = true) {
        this.responseTimeStats.totalRequests++;
        if (success) {
            this.responseTimeStats.successfulRequests++;
        } else {
            this.responseTimeStats.failedRequests++;
        }

        // Add to recent responses (keep last 20)
        this.responseTimeStats.recent.push({
            type,
            responseTime: responseTimeMs,
            timestamp: new Date().toISOString(),
            success
        });

        // Keep only last 20 responses
        if (this.responseTimeStats.recent.length > 20) {
            this.responseTimeStats.recent = this.responseTimeStats.recent.slice(-20);
        }
    }

    getAdminStats() {
        const recent = this.responseTimeStats.recent;
        const successful = recent.filter(r => r.success);
        
        const avgResponseTime = successful.length > 0 
            ? Math.round(successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length)
            : 0;

        const minResponseTime = successful.length > 0 
            ? Math.min(...successful.map(r => r.responseTime))
            : 0;

        const maxResponseTime = successful.length > 0 
            ? Math.max(...successful.map(r => r.responseTime))
            : 0;

        return {
            total: this.responseTimeStats.totalRequests,
            successful: this.responseTimeStats.successfulRequests,
            failed: this.responseTimeStats.failedRequests,
            successRate: this.responseTimeStats.totalRequests > 0 
                ? Math.round((this.responseTimeStats.successfulRequests / this.responseTimeStats.totalRequests) * 100)
                : 0,
            avgResponseTime,
            minResponseTime,
            maxResponseTime,
            recentRequests: recent.slice(-10) // Last 10 requests
        };
    }
}

module.exports = WellnessSystem;
