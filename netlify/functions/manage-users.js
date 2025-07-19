// netlify/functions/manage-users.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@wrongnumber.netlify.app'
};

// In-memory storage (use real database in production)
const pendingUsers = new Map();
const approvedUsers = new Map();
const rejectedUsers = new Map();
const userActions = [];

function validateAdminToken(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return false;
    }
    
    const token = authHeader.substring(7);
    
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return false;
        }
        
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
        
        if (payload.expires && payload.expires < Date.now()) {
            return false;
        }
        
        if (payload.type !== 'admin_session') {
            return false;
        }
        
        const expectedSignature = crypto
            .createHmac('sha256', CONFIG.JWT_SECRET)
            .update(\`\${parts[0]}.\${parts[1]}\`)
            .digest('base64url');
        
        return parts[2] === expectedSignature;
    } catch (error) {
        return false;
    }
}

function logUserAction(action, adminId, targetUserId, details = {}) {
    const logEntry = {
        id: crypto.randomBytes(8).toString('hex'),
        action,
        adminId,
        targetUserId,
        details,
        timestamp: Date.now()
    };
    
    userActions.push(logEntry);
    console.log('[USER_ACTION]', logEntry);
    
    return logEntry;
}

async function sendNotificationEmail(type, userData) {
    // In production, integrate with email service
    console.log(\`Email notification: \${type}\`, userData);
    return true;
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://wrongnumber.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, GET, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    try {
        const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
        const authHeader = event.headers['authorization'];
        
        // Validate admin token
        if (!validateAdminToken(authHeader)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Unauthorized access' 
                })
            };
        }
        
        const path = event.path.split('/').pop();
        const method = event.httpMethod;
        
        switch (\`\${method}_\${path}\`) {
            case 'POST_approve':
                return await approveUser(event, clientIP);
            case 'POST_reject':
                return await rejectUser(event, clientIP);
            case 'POST_suspend':
                return await suspendUser(event, clientIP);
            case 'POST_activate':
                return await activateUser(event, clientIP);
            case 'DELETE_remove':
                return await removeUser(event, clientIP);
            case 'GET_list':
                return await listUsers(event, clientIP);
            case 'POST_bulk-action':
                return await bulkAction(event, clientIP);
            default:
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        message: 'Endpoint not found' 
                    })
                };
        }
        
    } catch (error) {
        console.error('Manage users error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Server error managing users' 
            })
        };
    }
};

async function approveUser(event, clientIP) {
    const body = JSON.parse(event.body);
    const { userId, notes = '' } = body;
    
    if (!userId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'User ID required' 
            })
        };
    }
    
    const pendingUser = pendingUsers.get(userId);
    if (!pendingUser) {
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Pending user not found' 
            })
        };
    }
    
    // Move user to approved
    const approvedUser = {
        ...pendingUser,
        status: 'active',
        approvedAt: Date.now(),
        approvedBy: 'admin',
        notes: notes
    };
    
    approvedUsers.set(pendingUser.hwid, approvedUser);
    pendingUsers.delete(userId);
    
    // Log action
    logUserAction('USER_APPROVED', 'admin', userId, {
        userName: pendingUser.name,
        hwid: pendingUser.hwid,
        notes: notes
    });
    
    // Send notification email
    try {
        await sendNotificationEmail('approval', approvedUser);
    } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
    }
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            message: 'User approved successfully',
            user: {
                id: approvedUser.id,
                name: approvedUser.name,
                status: approvedUser.status,
                approvedAt: approvedUser.approvedAt
            }
        })
    };
}

async function rejectUser(event, clientIP) {
    const body = JSON.parse(event.body);
    const { userId, reason = 'Not specified' } = body;
    
    if (!userId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'User ID required' 
            })
        };
    }
    
    const pendingUser = pendingUsers.get(userId);
    if (!pendingUser) {
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Pending user not found' 
            })
        };
    }
    
    // Move user to rejected
    const rejectedUser = {
        ...pendingUser,
        status: 'rejected',
        rejectedAt: Date.now(),
        rejectedBy: 'admin',
        rejectionReason: reason
    };
    
    rejectedUsers.set(userId, rejectedUser);
    pendingUsers.delete(userId);
    
    // Log action
    logUserAction('USER_REJECTED', 'admin', userId, {
        userName: pendingUser.name,
        hwid: pendingUser.hwid,
        reason: reason
    });
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            success: true,
            message: 'User rejected successfully'
        })
    };
}

async function suspendUser(event, clientIP) {
    // Implementation for suspending users
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'User suspended' })
    };
}

async function activateUser(event, clientIP) {
    // Implementation for activating users
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'User activated' })
    };
}

async function removeUser(event, clientIP) {
    // Implementation for removing users
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'User removed' })
    };
}

async function listUsers(event, clientIP) {
    // Implementation for listing users
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            success: true, 
            users: Array.from(approvedUsers.values()),
            pending: Array.from(pendingUsers.values())
        })
    };
}

async function bulkAction(event, clientIP) {
    // Implementation for bulk actions
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, message: 'Bulk action completed' })
    };
}
