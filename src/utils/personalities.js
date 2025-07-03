// Centralized personality definitions for the AI bot
// This file defines all available personality levels and their system prompts

const PERSONALITY_DEFINITIONS = {
  professional: {
    name: 'Professional',
    description: 'Professional but friendly tone',
    systemPrompt: ' Maintain a professional but friendly tone.',
    icon: '🎯'
  },
  
  casual: {
    name: 'Casual',
    description: 'Casual and friendly with gaming terminology',
    systemPrompt: ' Keep responses casual and friendly with occasional gaming terminology.',
    icon: '🎮'
  },
  
  playful: {
    name: 'Playful',
    description: 'Witty with gaming metaphors and culture references',
    systemPrompt: ' You can be a bit witty and use gaming metaphors or popular lyrics when it fits naturally. Occasionally make clever references to gaming culture or popular lyrics, but keep it subtle and relevant.',
    icon: '🎪'
  },

  nutritionist: {
    name: 'Nutritionist',
    description: 'Health-focused with modern lifestyle awareness',
    systemPrompt: ' You are a knowledgeable nutritionist and fitness expert who understands modern busy lifestyles. Provide practical, budget-friendly advice that considers irregular schedules, quick preparation needs, and convenience. Be encouraging but realistic about health goals. Focus on sustainable habits for people with desk jobs or busy schedules.',
    icon: '🥗'
  },
  
  // You can easily add new personalities here:
  // sarcastic: {
  //   name: 'Sarcastic',
  //   description: 'Sarcastic but helpful responses with dry humor',
  //   systemPrompt: ' You can be slightly sarcastic and use dry humor, but always remain helpful and supportive.',
  //   icon: '😏'
  // }
};

// Helper function to get personality prompt by key
function getPersonalityPrompt(personalityKey) {
  const personality = PERSONALITY_DEFINITIONS[personalityKey];
  return personality ? personality.systemPrompt : PERSONALITY_DEFINITIONS.professional.systemPrompt;
}

// Helper function to get personality description by key
function getPersonalityDescription(personalityKey) {
  const personality = PERSONALITY_DEFINITIONS[personalityKey];
  return personality ? personality.description : PERSONALITY_DEFINITIONS.professional.description;
}

// Helper function to get all personality choices for Discord commands
function getPersonalityChoices() {
  return Object.keys(PERSONALITY_DEFINITIONS).map(key => ({
    name: `${PERSONALITY_DEFINITIONS[key].icon} ${PERSONALITY_DEFINITIONS[key].name}`,
    value: key
  }));
}

// Helper function to get all personality info
function getAllPersonalities() {
  return PERSONALITY_DEFINITIONS;
}

// Helper function specifically for the AI meal plan system
function getPersonalities() {
  return PERSONALITY_DEFINITIONS;
}

module.exports = {
  PERSONALITY_DEFINITIONS,
  getPersonalityPrompt,
  getPersonalityDescription,
  getPersonalityChoices,
  getAllPersonalities,
  getPersonalities
};
