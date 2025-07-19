// netlify/functions/check-approval.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    CHECK_RATE_LIMIT: 30, // max checks per hour
    CHECK_WINDOW: 60 * 60 * 1000 // 1 hour
};

// In-memory storage (use real database in production)
const approvedUsers = new Map();
const pendingUsers = new Map();
const checkAttempts = new Map();

// Sample approved users (in production, load from database)
// approvedUsers.set('sample_hwid_123', {
//     id: 'user_001',
//     name: 'John Doe',
//     hwid: 'sample_hwid_123',
//     approvedAt: Date.now(),
//     approvedBy: 'admin',
//     status: 'active'
// });

function validateToken(authToken) {
    if (!authToken || typeof authToken !== 'string') {
        return false;
    }
    
    try {
        const parts = authToken.split('.');
        if (parts.length !== 3) {
            return false;
        }
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        
        // Check if token is expired
        if (payload.expires && payload.expires < Date.now()) {
            return false;
        }
        
        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', CONFIG.JWT_SECRET)
            .update(`${parts[0]}.${parts[1]}`)
            .digest('base64url');
        
        return parts[2] === expectedSignature;
    } catch (error) {
        return false;
    }
}

function checkRateLimit(ip, hwid) {
    const key = `check_${ip}_${hwid}`;
    const now = Date.now();
    
    if (!checkAttempts.has(key)) {
        checkAttempts.set(key, { count: 0, resetTime: now + CONFIG.CHECK_WINDOW });
    }
    
    const attempts = checkAttempts.get(key);
    
    if (now > attempts.resetTime) {
        attempts.count = 0;
        attempts.resetTime = now + CONFIG.CHECK_WINDOW;
    }
    
    if (attempts.count >= CONFIG.CHECK_RATE_LIMIT) {
        return false;
    }
    
    attempts.count++;
    return true;
}

function logApprovalCheck(type, data) {
    const timestamp = new Date().toISOString();
    console.log(`[APPROVAL_CHECK] ${timestamp} - ${type}:`, data);
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://wrongnumber.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
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
        const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
        const authToken = event.headers['x-auth-token'];
        
        if (!validateToken(authToken)) {
            logApprovalCheck('INVALID_TOKEN', { ip: clientIP });
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ success: false, message: 'Invalid token' })
            };
        }
        
        const body = JSON.parse(event.body);
        const { hwid, timestamp } = body;
        
        if (!hwid) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, message: 'HWID required' })
            };
        }
        
        // Check rate limiting
        if (!checkRateLimit(clientIP, hwid)) {
            logApprovalCheck('RATE_LIMITED', { ip: clientIP, hwid });
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Too many check attempts' 
                })
            };
        }
        
        // Check if user is approved
        const approvedUser = approvedUsers.get(hwid);
        
        if (approvedUser && approvedUser.status === 'active') {
            logApprovalCheck('USER_APPROVED', { 
                ip: clientIP, 
                hwid,
                userId: approvedUser.id 
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    approved: true,
                    user: {
                        id: approvedUser.id,
                        name: approvedUser.name,
                        approvedAt: approvedUser.approvedAt
                    }
                })
            };
        }
        
        // Check if still pending
        const pendingUser = Array.from(pendingUsers.values()).find(user => user.hwid === hwid);
        
        if (pendingUser) {
            logApprovalCheck('USER_PENDING', { 
                ip: clientIP, 
                hwid,
                userId: pendingUser.id 
            });
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    approved: false,
                    status: 'pending',
                    message: 'Your request is still under review'
                })
            };
        }
        
        // User not found
        logApprovalCheck('USER_NOT_FOUND', { ip: clientIP, hwid });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                approved: false,
                status: 'not_found',
                message: 'No registration found for this device'
            })
        };
        
    } catch (error) {
        console.error('Check approval error:', error);
        
        logApprovalCheck('FUNCTION_ERROR', {
            error: error.message,
            stack: error.stack
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: 'Server error' })
        };
    }
};