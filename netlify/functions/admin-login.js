// netlify/functions/admin-login.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123!@#',
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    TWO_FACTOR_SECRET: process.env.TWO_FACTOR_SECRET || 'your-2fa-secret',
    ENABLE_2FA: process.env.ENABLE_2FA === 'true',
    LOGIN_RATE_LIMIT: 5, // max attempts per hour
    LOGIN_WINDOW: 60 * 60 * 1000, // 1 hour
    SESSION_DURATION: 24 * 60 * 60 * 1000 // 24 hours
};

// In-memory storage
const loginAttempts = new Map();
const activeSessions = new Map();
const backupCodes = new Set([
    '123456789',
    '987654321',
    '456789123',
    '789123456',
    '321654987'
]);

function hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'salt').digest('hex');
}

function generateJWT(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', CONFIG.JWT_SECRET)
        .update(`${header}.${payloadEncoded}`)
        .digest('base64url');
    
    return `${header}.${payloadEncoded}.${signature}`;
}

function generateTOTP(secret, window = 0) {
    const time = Math.floor(Date.now() / 1000 / 30) + window;
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeUInt32BE(time, 4);
    
    const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base32'));
    hmac.update(timeBuffer);
    const hash = hmac.digest();
    
    const offset = hash[19] & 0x0f;
    const truncated = ((hash[offset] & 0x7f) << 24) |
                     ((hash[offset + 1] & 0xff) << 16) |
                     ((hash[offset + 2] & 0xff) << 8) |
                     (hash[offset + 3] & 0xff);
    
    return (truncated % 1000000).toString().padStart(6, '0');
}

function validateTOTP(token, secret) {
    if (!token || token.length !== 6) {
        return false;
    }
    
    // Check current window and ±1 window for clock skew
    for (let window = -1; window <= 1; window++) {
        if (generateTOTP(secret, window) === token) {
            return true;
        }
    }
    
    return false;
}

function checkLoginRateLimit(ip) {
    const now = Date.now();
    
    if (!loginAttempts.has(ip)) {
        loginAttempts.set(ip, { count: 0, resetTime: now + CONFIG.LOGIN_WINDOW });
    }
    
    const attempts = loginAttempts.get(ip);
    
    if (now > attempts.resetTime) {
        attempts.count = 0;
        attempts.resetTime = now + CONFIG.LOGIN_WINDOW;
    }
    
    if (attempts.count >= CONFIG.LOGIN_RATE_LIMIT) {
        return false;
    }
    
    attempts.count++;
    return true;
}

function logSecurityEvent(type, data) {
    const timestamp = new Date().toISOString();
    console.log(`[ADMIN_SECURITY] ${timestamp} - ${type}:`, data);
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://wrongnumber.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type',
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
        const userAgent = event.headers['user-agent'] || 'unknown';
        
        // Check rate limiting
        if (!checkLoginRateLimit(clientIP)) {
            logSecurityEvent('LOGIN_RATE_LIMITED', { ip: clientIP, userAgent });
            return {
                statusCode: 429,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Too many login attempts. Please try again later.' 
                })
            };
        }
        
        const body = JSON.parse(event.body);
        const { password, twoFactorCode, timestamp } = body;
        
        // Validate timestamp (prevent replay attacks)
        const now = Date.now();
        const requestTime = parseInt(timestamp);
        const timeDiff = Math.abs(now - requestTime);
        
        if (timeDiff > 300000) { // 5 minutes tolerance
            logSecurityEvent('LOGIN_TIMESTAMP_INVALID', {
                ip: clientIP,
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
        if (!password) {
            logSecurityEvent('LOGIN_NO_PASSWORD', { ip: clientIP });
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Password required' 
                })
            };
        }
        
        const hashedPassword = hashPassword(password);
        const hashedCorrect = hashPassword(CONFIG.ADMIN_PASSWORD);
        
        if (hashedPassword !== hashedCorrect) {
            logSecurityEvent('LOGIN_INVALID_PASSWORD', { 
                ip: clientIP, 
                userAgent,
                attemptedPassword: password.substring(0, 3) + '***'
            });
            
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Invalid credentials' 
                })
            };
        }
        
        // Check if 2FA is required
        if (CONFIG.ENABLE_2FA) {
            if (!twoFactorCode) {
                logSecurityEvent('LOGIN_2FA_REQUIRED', { ip: clientIP });
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        requiresTwoFactor: true,
                        message: 'Two-factor authentication required'
                    })
                };
            }
            
            // Validate 2FA code
            const isValidTOTP = validateTOTP(twoFactorCode, CONFIG.TWO_FACTOR_SECRET);
            const isValidBackup = backupCodes.has(twoFactorCode);
            
            if (!isValidTOTP && !isValidBackup) {
                logSecurityEvent('LOGIN_INVALID_2FA', { 
                    ip: clientIP, 
                    code: twoFactorCode 
                });
                
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        message: 'Invalid two-factor authentication code' 
                    })
                };
            }
            
            // If backup code was used, remove it
            if (isValidBackup) {
                backupCodes.delete(twoFactorCode);
                logSecurityEvent('LOGIN_BACKUP_CODE_USED', { 
                    ip: clientIP, 
                    code: twoFactorCode 
                });
            }
        }
        
        // Generate session token
        const sessionId = crypto.randomBytes(32).toString('hex');
        const tokenPayload = {
            sessionId: sessionId,
            type: 'admin_session',
            ip: clientIP,
            userAgent: userAgent,
            loginTime: now,
            expires: now + CONFIG.SESSION_DURATION
        };
        
        const token = generateJWT(tokenPayload);
        
        // Store session
        activeSessions.set(sessionId, {
            ip: clientIP,
            userAgent: userAgent,
            loginTime: now,
            lastActivity: now,
            expires: now + CONFIG.SESSION_DURATION
        });
        
        // Log successful login
        logSecurityEvent('LOGIN_SUCCESS', { 
            ip: clientIP, 
            userAgent,
            sessionId: sessionId,
            twoFactorUsed: CONFIG.ENABLE_2FA
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                token: token,
                user: {
                    name: 'Administrator',
                    role: 'admin',
                    loginTime: now
                },
                expiresIn: CONFIG.SESSION_DURATION
            })
        };
        
    } catch (error) {
        console.error('Admin login error:', error);
        
        logSecurityEvent('LOGIN_FUNCTION_ERROR', {
            error: error.message,
            stack: error.stack
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Server error during login' 
            })
        };
    }
};