// netlify/functions/validate-access.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    ACCESS_PASSWORD: process.env.ACCESS_PASSWORD || 'defaultpass123',
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    RATE_LIMIT_MAX: 10, // requests per hour
    RATE_LIMIT_WINDOW: 60 * 60 * 1000 // 1 hour
};

// In-memory storage (use real database in production)
const rateLimitStore = new Map();
const blacklistedIPs = new Set();

// Utility Functions
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', CONFIG.JWT_SECRET)
        .update(`${header}.${payloadEncoded}`)
        .digest('base64url');
    
    return `${header}.${payloadEncoded}.${signature}`;
}

function validateRequest(event) {
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const userAgent = event.headers['user-agent'] || '';
    const referer = event.headers['referer'] || '';
    
    // Check if IP is blacklisted
    if (blacklistedIPs.has(clientIP)) {
        return { valid: false, reason: 'IP blacklisted' };
    }
    
    // Basic security checks
    if (!userAgent || userAgent.length < 10) {
        return { valid: false, reason: 'Invalid user agent' };
    }
    
    // Check rate limiting
    const rateLimitKey = `rate_limit_${clientIP}`;
    const now = Date.now();
    
    if (!rateLimitStore.has(rateLimitKey)) {
        rateLimitStore.set(rateLimitKey, { count: 0, resetTime: now + CONFIG.RATE_LIMIT_WINDOW });
    }
    
    const rateLimitData = rateLimitStore.get(rateLimitKey);
    
    if (now > rateLimitData.resetTime) {
        rateLimitData.count = 0;
        rateLimitData.resetTime = now + CONFIG.RATE_LIMIT_WINDOW;
    }
    
    if (rateLimitData.count >= CONFIG.RATE_LIMIT_MAX) {
        return { valid: false, reason: 'Rate limit exceeded' };
    }
    
    rateLimitData.count++;
    
    return { valid: true, clientIP, userAgent, referer };
}

function validatePassword(inputPassword) {
    const hashedInput = hashPassword(inputPassword);
    const hashedCorrect = hashPassword(CONFIG.ACCESS_PASSWORD);
    return hashedInput === hashedCorrect;
}

function logSecurityEvent(type, details) {
    const timestamp = new Date().toISOString();
    console.log(`[SECURITY] ${timestamp} - ${type}:`, details);
    
    // In production, save to database
    // await saveSecurityLog({ timestamp, type, details });
}

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': 'https://wrongnumber.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }
    
    try {
        // Parse request body
        const body = JSON.parse(event.body);
        const { password, timestamp, userAgent, referrer } = body;
        
        // Validate request
        const validation = validateRequest(event);
        if (!validation.valid) {
            logSecurityEvent('VALIDATION_FAILED', {
                reason: validation.reason,
                ip: validation.clientIP || 'unknown',
                userAgent: event.headers['user-agent']
            });
            
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Access denied' 
                })
            };
        }
        
        // Check timestamp (prevent replay attacks)
        const now = Date.now();
        const requestTime = parseInt(timestamp);
        const timeDiff = Math.abs(now - requestTime);
        
        if (timeDiff > 300000) { // 5 minutes tolerance
            logSecurityEvent('TIMESTAMP_INVALID', {
                ip: validation.clientIP,
                timestamp: requestTime,
                difference: timeDiff
            });
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Request expired' 
                })
            };
        }
        
        // Validate password
        if (!password || !validatePassword(password)) {
            logSecurityEvent('INVALID_PASSWORD', {
                ip: validation.clientIP,
                userAgent: validation.userAgent,
                attempt: password ? 'wrong_password' : 'empty_password'
            });
            
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Invalid access password' 
                })
            };
        }
        
        // Generate access token
        const tokenPayload = {
            type: 'script_download',
            ip: validation.clientIP,
            userAgent: validation.userAgent,
            timestamp: now,
            expires: now + (24 * 60 * 60 * 1000) // 24 hours
        };
        
        const token = generateToken(tokenPayload);
        
        // Log successful validation
        logSecurityEvent('ACCESS_GRANTED', {
            ip: validation.clientIP,
            userAgent: validation.userAgent,
            referer: validation.referer
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token: token,
                message: 'Access granted'
            })
        };
        
    } catch (error) {
        console.error('Validate access error:', error);
        
        logSecurityEvent('FUNCTION_ERROR', {
            error: error.message,
            stack: error.stack
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Server error' 
            })
        };
    }
};