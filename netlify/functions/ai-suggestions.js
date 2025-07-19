// netlify/functions/ai-suggestions.js
const crypto = require('crypto');

// Simple AI suggestion service (in production, integrate with OpenAI/Claude/etc.)
const CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    MAX_TEXT_LENGTH: 1000,
    RATE_LIMIT: 20 // requests per hour per device
};

// In-memory storage
const rateLimitStore = new Map();
const suggestionTemplates = {
    essay: [
        "Consider expanding on this point with specific examples",
        "This argument could benefit from supporting evidence",
        "Try connecting this idea to the main thesis",
        "Consider addressing potential counterarguments"
    ],
    discussion: [
        "Great insight! Have you considered how this relates to...",
        "This perspective is interesting. What evidence supports it?",
        "How does this connect to what we discussed in class?",
        "Can you elaborate on this point with more detail?"
    ],
    quiz: [
        "Review the key concepts from chapter",
        "Consider the relationship between these terms",
        "Think about the practical applications",
        "Remember the examples discussed in lecture"
    ]
};

function validateRequest(event) {
    const deviceId = event.headers['x-device-id'];
    const timestamp = event.headers['x-timestamp'];
    
    if (!deviceId || !timestamp) {
        return { valid: false, reason: 'Missing headers' };
    }
    
    // Check rate limiting
    const rateLimitKey = `suggestions_${deviceId}`;
    const now = Date.now();
    
    if (!rateLimitStore.has(rateLimitKey)) {
        rateLimitStore.set(rateLimitKey, { count: 0, resetTime: now + (60 * 60 * 1000) });
    }
    
    const rateLimitData = rateLimitStore.get(rateLimitKey);
    
    if (now > rateLimitData.resetTime) {
        rateLimitData.count = 0;
        rateLimitData.resetTime = now + (60 * 60 * 1000);
    }
    
    if (rateLimitData.count >= CONFIG.RATE_LIMIT) {
        return { valid: false, reason: 'Rate limit exceeded' };
    }
    
    rateLimitData.count++;
    return { valid: true };
}

function generateSuggestions(text, context = 'general') {
    if (!text || text.length < 10) {
        return [];
    }
    
    const suggestions = [];
    const textLower = text.toLowerCase();
    
    // Determine content type
    let contentType = 'general';
    if (textLower.includes('essay') || textLower.includes('paper') || textLower.includes('argument')) {
        contentType = 'essay';
    } else if (textLower.includes('discuss') || textLower.includes('forum') || textLower.includes('response')) {
        contentType = 'discussion';
    } else if (textLower.includes('quiz') || textLower.includes('test') || textLower.includes('exam')) {
        contentType = 'quiz';
    }
    
    // Get relevant templates
    const templates = suggestionTemplates[contentType] || suggestionTemplates.discussion;
    
    // Simple suggestion logic (in production, use real AI)
    if (text.length < 50) {
        suggestions.push("Consider expanding your response with more detail");
    }
    
    if (text.split('.').length < 3) {
        suggestions.push("Breaking this into multiple sentences might improve clarity");
    }
    
    if (!textLower.includes('because') && !textLower.includes('therefore') && !textLower.includes('thus')) {
        suggestions.push("Consider adding reasoning or evidence to support your points");
    }
    
    // Add random template suggestions
    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    suggestions.push(randomTemplate);
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Device-ID, X-Timestamp',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }
    
    try {
        const validation = validateRequest(event);
        if (!validation.valid) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ success: false, message: validation.reason })
            };
        }
        
        const body = JSON.parse(event.body);
        const { text, context } = body;
        
        if (!text || text.length > CONFIG.MAX_TEXT_LENGTH) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid text input' })
            };
        }
        
        const suggestions = generateSuggestions(text, context);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                suggestions: suggestions,
                context: context || 'general'
            })
        };
        
    } catch (error) {
        console.error('AI suggestions error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Server error' })
        };
    }
};
