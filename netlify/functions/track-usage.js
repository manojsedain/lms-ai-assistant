// netlify/functions/track-usage.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    MAX_EVENTS_PER_HOUR: 100,
    RETENTION_DAYS: 30
};

// In-memory storage (use real database in production)
const usageEvents = [];
const rateLimitStore = new Map();

function validateRequest(event) {
    const deviceId = event.headers['x-device-id'];
    const scriptVersion = event.headers['x-script-version'];
    
    if (!deviceId || !scriptVersion) {
        return { valid: false, reason: 'Missing headers' };
    }
    
    // Check rate limiting
    const rateLimitKey = `usage_${deviceId}`;
    const now = Date.now();
    
    if (!rateLimitStore.has(rateLimitKey)) {
        rateLimitStore.set(rateLimitKey, { count: 0, resetTime: now + (60 * 60 * 1000) });
    }
    
    const rateLimitData = rateLimitStore.get(rateLimitKey);
    
    if (now > rateLimitData.resetTime) {
        rateLimitData.count = 0;
        rateLimitData.resetTime = now + (60 * 60 * 1000);
    }
    
    if (rateLimitData.count >= CONFIG.MAX_EVENTS_PER_HOUR) {
        return { valid: false, reason: 'Rate limit exceeded' };
    }
    
    rateLimitData.count++;
    return { valid: true };
}

function cleanupOldEvents() {
    const cutoffTime = Date.now() - (CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const originalLength = usageEvents.length;
    
    for (let i = usageEvents.length - 1; i >= 0; i--) {
        if (usageEvents[i].timestamp < cutoffTime) {
            usageEvents.splice(i, 1);
        }
    }
    
    if (usageEvents.length !== originalLength) {
        console.log(`Cleaned up ${originalLength - usageEvents.length} old usage events`);
    }
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Device-ID, X-Script-Version',
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
        const { action, data, url, timestamp, deviceInfo } = body;
        
        const usageEvent = {
            id: crypto.randomBytes(8).toString('hex'),
            deviceId: event.headers['x-device-id'],
            scriptVersion: event.headers['x-script-version'],
            action: action || 'unknown',
            data: data || {},
            url: url || 'unknown',
            timestamp: timestamp || Date.now(),
            deviceInfo: deviceInfo || {},
            ip: event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown'
        };
        
        usageEvents.push(usageEvent);
        
        // Cleanup old events periodically
        if (usageEvents.length % 100 === 0) {
            cleanupOldEvents();
        }
        
        console.log('[USAGE_TRACKED]', {
            action: usageEvent.action,
            deviceId: usageEvent.deviceId,
            timestamp: usageEvent.timestamp
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                eventId: usageEvent.id
            })
        };
        
    } catch (error) {
        console.error('Track usage error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Server error' })
        };
    }
};
