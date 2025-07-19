// netlify/functions/register-user.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@wrongnumber.netlify.app',
    EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID,
    EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID,
    EMAILJS_USER_ID: process.env.EMAILJS_USER_ID,
    MAX_NAME_LENGTH: 100,
    MAX_HWID_LENGTH: 64
};

// In-memory storage (use real database in production)
const pendingUsers = new Map();
const registrationAttempts = new Map();

// Utility Functions
function generateUserId() {
    return crypto.randomBytes(16).toString('hex');
}

function sanitizeInput(input, maxLength) {
    if (!input || typeof input !== 'string') {
        return '';
    }
    return input.trim().substring(0, maxLength);
}

function validateHWID(hwid) {
    if (!hwid || typeof hwid !== 'string') {
        return false;
    }
    
    // HWID should be alphanumeric and reasonable length
    const hwidRegex = /^[a-zA-Z0-9]{10,64}$/;
    return hwidRegex.test(hwid);
}

function validateUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== 'string') {
        return false;
    }
    
    // Basic user agent validation
    return userAgent.length > 10 && userAgent.length < 500;
}

function checkRateLimit(ip, hwid) {
    const key = `${ip}_${hwid}`;
    const now = Date.now();
    const windowSize = 60 * 60 * 1000; // 1 hour
    const maxAttempts = 3;
    
    if (!registrationAttempts.has(key)) {
        registrationAttempts.set(key, { count: 0, firstAttempt: now });
    }
    
    const attempts = registrationAttempts.get(key);
    
    // Reset if window has passed
    if (now - attempts.firstAttempt > windowSize) {
        attempts.count = 0;
        attempts.firstAttempt = now;
    }
    
    attempts.count++;
    
    return attempts.count <= maxAttempts;
}

function validateToken(authToken) {
    // In production, properly validate JWT token
    return authToken && authToken.length > 20;
}

async function sendAdminNotification(userData) {
    // In production, integrate with EmailJS or similar service
    console.log('New user registration:', userData);
    
    // Simulate email sending
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`Admin notification sent for user: ${userData.name}`);
            resolve(true);
        }, 100);
    });
}

function logRegistrationEvent(type, data) {
    const timestamp = new Date().toISOString();
    console.log(`[REGISTRATION] ${timestamp} - ${type}:`, data);
}

exports.handler = async (event, context) => {
    // Enable CORS
    const headers = {
        'Access-Control-Allow-Origin': 'https://wrongnumber.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
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
        // Get client info
        const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
        const authToken = event.headers['x-auth-token'];
        
        // Validate auth token
        if (!validateToken(authToken)) {
            logRegistrationEvent('INVALID_TOKEN', { ip: clientIP });
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Invalid authentication token' 
                })
            };
        }
        
        // Parse request body
        const body = JSON.parse(event.body);
        const { name, hwid, userAgent, timestamp, url } = body;
        
        // Validate required fields
        if (!name || !hwid || !userAgent) {
            logRegistrationEvent('MISSING_FIELDS', { ip: clientIP, body });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Missing required fields' 
                })
            };
        }
        
        // Sanitize and validate inputs
        const sanitizedName = sanitizeInput(name, CONFIG.MAX_NAME_LENGTH);
        const sanitizedHwid = sanitizeInput(hwid, CONFIG.MAX_HWID_LENGTH);
        
        if (!sanitizedName || sanitizedName.length < 2) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Invalid name provided' 
                })
            };
        }
        
        if (!validateHWID(sanitizedHwid)) {
            logRegistrationEvent('INVALID_HWID', { 
                ip: clientIP, 
                hwid: sanitizedHwid,
                name: sanitizedName 
            });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Invalid device identifier' 
                })
            };
        }
        
        if (!validateUserAgent(userAgent)) {
            logRegistrationEvent('INVALID_USER_AGENT', { 
                ip: clientIP, 
                userAgent,
                name: sanitizedName 
            });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Invalid browser information' 
                })
            };
        }
        
        // Check rate limiting
        if (!checkRateLimit(clientIP, sanitizedHwid)) {
            logRegistrationEvent('RATE_LIMITED', { 
                ip: clientIP, 
                hwid: sanitizedHwid,
                name: sanitizedName 
            });
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Too many registration attempts. Please try again later.' 
                })
            };
        }
        
        // Check if user already exists
        const existingUser = Array.from(pendingUsers.values()).find(user => 
            user.hwid === sanitizedHwid || 
            (user.name.toLowerCase() === sanitizedName.toLowerCase() && user.ip === clientIP)
        );
        
        if (existingUser) {
            logRegistrationEvent('DUPLICATE_REGISTRATION', { 
                ip: clientIP, 
                hwid: sanitizedHwid,
                name: sanitizedName,
                existing: existingUser.id
            });
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Registration already exists for this device or user' 
                })
            };
        }
        
        // Create user registration
        const userId = generateUserId();
        const registrationData = {
            id: userId,
            name: sanitizedName,
            hwid: sanitizedHwid,
            ip: clientIP,
            userAgent: userAgent,
            url: url || 'unknown',
            timestamp: Date.now(),
            status: 'pending',
            requestTimestamp: timestamp
        };
        
        // Store pending registration
        pendingUsers.set(userId, registrationData);
        
        // Send admin notification
        try {
            await sendAdminNotification(registrationData);
        } catch (emailError) {
            console.error('Failed to send admin notification:', emailError);
            // Continue even if email fails
        }
        
        // Log successful registration
        logRegistrationEvent('USER_REGISTERED', {
            id: userId,
            name: sanitizedName,
            hwid: sanitizedHwid,
            ip: clientIP
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Registration submitted successfully',
                requestId: userId
            })
        };
        
    } catch (error) {
        console.error('Register user error:', error);
        
        logRegistrationEvent('FUNCTION_ERROR', {
            error: error.message,
            stack: error.stack
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Server error during registration' 
            })
        };
    }
};
