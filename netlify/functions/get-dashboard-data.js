// netlify/functions/get-dashboard-data.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    CACHE_DURATION: 5 * 60 * 1000 // 5 minutes cache
};

// In-memory storage (use real database in production)
const dashboardCache = new Map();
const systemStats = {
    totalUsers: 127,
    pendingRequests: 8,
    activeUsers: 89,
    blockedDevices: 3,
    totalRequests: 15420,
    successfulRequests: 15102,
    failedRequests: 318,
    uptime: Date.now() - (72 * 60 * 60 * 1000), // 72 hours ago
    lastBackup: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
    storageUsed: 45,
    activeConnections: 23
};

const recentActivity = [
    {
        id: 1,
        type: 'user_registration',
        title: 'New user registration',
        description: 'John Doe requested access',
        timestamp: Date.now() - (5 * 60 * 1000),
        user: 'John Doe',
        avatar: 'J',
        severity: 'info'
    },
    {
        id: 2,
        type: 'script_update',
        title: 'Script updated',
        description: 'Main AI script v1.2.0 deployed',
        timestamp: Date.now() - (2 * 60 * 60 * 1000),
        user: 'System',
        avatar: 'S',
        severity: 'success'
    },
    {
        id: 3,
        type: 'user_approved',
        title: 'User approved',
        description: 'Jane Smith gained access',
        timestamp: Date.now() - (24 * 60 * 60 * 1000),
        user: 'Administrator',
        avatar: 'A',
        severity: 'success'
    },
    {
        id: 4,
        type: 'security_alert',
        title: 'Security alert',
        description: 'Suspicious login attempt blocked',
        timestamp: Date.now() - (3 * 60 * 60 * 1000),
        user: 'Security System',
        avatar: '🛡️',
        severity: 'warning'
    },
    {
        id: 5,
        type: 'device_blocked',
        title: 'Device blocked',
        description: 'Device hwid_abc123 blocked for policy violation',
        timestamp: Date.now() - (6 * 60 * 60 * 1000),
        user: 'Administrator',
        avatar: 'A',
        severity: 'error'
    }
];

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
        
        // Check if token is expired
        if (payload.expires && payload.expires < Date.now()) {
            return false;
        }
        
        // Check if it's an admin session
        if (payload.type !== 'admin_session') {
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

function calculateStats() {
    const now = Date.now();
    
    // Simulate some dynamic data
    const baseStats = { ...systemStats };
    
    // Add some variance to make it look live
    baseStats.activeUsers += Math.floor(Math.random() * 10) - 5;
    baseStats.activeConnections += Math.floor(Math.random() * 6) - 3;
    baseStats.totalRequests += Math.floor(Math.random() * 50);
    
    // Calculate derived stats
    const uptimeHours = Math.floor((now - baseStats.uptime) / (60 * 60 * 1000));
    const successRate = ((baseStats.successfulRequests / baseStats.totalRequests) * 100).toFixed(1);
    
    // Calculate growth percentages
    const usersGrowth = '+12.5%';
    const activeGrowth = '+8.3%';
    const pendingChange = baseStats.pendingRequests > 0 ? `${baseStats.pendingRequests} new today` : 'No new requests';
    const blockedChange = baseStats.blockedDevices > 0 ? `${baseStats.blockedDevices} this week` : 'None this week';
    
    return {
        ...baseStats,
        uptimeHours,
        successRate,
        usersGrowth,
        activeGrowth,
        pendingChange,
        blockedChange,
        serverUptime: `${uptimeHours} hours (99.9%)`,
        lastBackupFormatted: formatTimeAgo(baseStats.lastBackup)
    };
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    
    if (days > 0) {
        return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
}

function getSystemStatus() {
    const stats = calculateStats();
    
    let status = 'online';
    let statusClass = 'active';
    
    // Determine system status based on various factors
    if (stats.successRate < 95) {
        status = 'degraded';
        statusClass = 'warning';
    }
    
    if (stats.activeConnections < 5) {
        status = 'maintenance';
        statusClass = 'warning';
    }
    
    return {
        status,
        statusClass,
        uptime: stats.serverUptime,
        activeConnections: stats.activeConnections,
        lastBackup: stats.lastBackupFormatted,
        storageUsed: `${stats.storageUsed}%`
    };
}

function logDashboardAccess(ip, userAgent) {
    const timestamp = new Date().toISOString();
    console.log(`[DASHBOARD] ${timestamp} - Dashboard accessed from ${ip}`);
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': 'https://wrongnumber.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }
    
    try {
        const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
        const userAgent = event.headers['user-agent'] || 'unknown';
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
        
        // Check cache
        const cacheKey = 'dashboard_data';
        const now = Date.now();
        
        if (dashboardCache.has(cacheKey)) {
            const cached = dashboardCache.get(cacheKey);
            if (now - cached.timestamp < CONFIG.CACHE_DURATION) {
                logDashboardAccess(clientIP, userAgent);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        cached: true,
                        ...cached.data
                    })
                };
            }
        }
        
        // Generate fresh data
        const stats = calculateStats();
        const systemStatus = getSystemStatus();
        
        // Format recent activity with relative timestamps
        const formattedActivity = recentActivity.map(activity => ({
            ...activity,
            timeAgo: formatTimeAgo(activity.timestamp),
            timestamp: activity.timestamp
        }));
        
        const dashboardData = {
            stats: {
                totalUsers: stats.totalUsers,
                pendingRequests: stats.pendingRequests,
                activeUsers: stats.activeUsers,
                blockedDevices: stats.blockedDevices,
                usersChange: stats.usersGrowth,
                activeChange: stats.activeGrowth,
                pendingChange: stats.pendingChange,
                blockedChange: stats.blockedChange
            },
            activity: formattedActivity,
            system: systemStatus,
            performance: {
                totalRequests: stats.totalRequests,
                successfulRequests: stats.successfulRequests,
                failedRequests: stats.failedRequests,
                successRate: stats.successRate + '%',
                uptimeHours: stats.uptimeHours
            },
            timestamp: now
        };
        
        // Cache the data
        dashboardCache.set(cacheKey, {
            data: dashboardData,
            timestamp: now
        });
        
        logDashboardAccess(clientIP, userAgent);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                ...dashboardData
            })
        };
        
    } catch (error) {
        console.error('Dashboard data error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Server error loading dashboard data' 
            })
        };
    }
};
