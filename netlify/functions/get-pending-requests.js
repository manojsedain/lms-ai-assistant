// netlify/functions/get-pending-requests.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    MAX_RESULTS: 100
};

// Sample pending requests data (in production, load from database)
const pendingRequests = [
    {
        id: 'req_001',
        name: 'John Doe',
        hwid: 'hwid_abc123def456',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        requestDate: Date.now() - (2 * 60 * 60 * 1000), // 2 hours ago
        lastUrl: 'https://canvas.university.edu/courses/12345',
        status: 'pending',
        platform: 'Windows',
        browser: 'Chrome',
        location: 'United States',
        riskLevel: 'low',
        notes: ''
    },
    {
        id: 'req_002',
        name: 'Jane Smith',
        hwid: 'hwid_789xyz012abc',
        ip: '10.0.1.50',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
        requestDate: Date.now() - (30 * 60 * 1000), // 30 minutes ago
        lastUrl: 'https://moodle.college.edu/mod/quiz/view.php',
        status: 'pending',
        platform: 'macOS',
        browser: 'Safari',
        location: 'Canada',
        riskLevel: 'low',
        notes: 'Regular student account'
    },
    {
        id: 'req_003',
        name: 'Mike Johnson',
        hwid: 'hwid_suspicious123',
        ip: '203.0.113.42',
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        requestDate: Date.now() - (15 * 60 * 1000), // 15 minutes ago
        lastUrl: 'https://blackboard.school.edu/ultra/courses',
        status: 'pending',
        platform: 'Linux',
        browser: 'Chrome',
        location: 'Unknown',
        riskLevel: 'medium',
        notes: 'Multiple registration attempts from different IPs'
    },
    {
        id: 'req_004',
        name: 'Sarah Wilson',
        hwid: 'hwid_def456ghi789',
        ip: '172.16.0.25',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101',
        requestDate: Date.now() - (5 * 60 * 1000), // 5 minutes ago
        lastUrl: 'https://brightspace.university.edu/d2l/home',
        status: 'pending',
        platform: 'Windows',
        browser: 'Firefox',
        location: 'United Kingdom',
        riskLevel: 'low',
        notes: ''
    },
    {
        id: 'req_005',
        name: 'Alex Chen',
        hwid: 'hwid_mobile456def',
        ip: '198.51.100.15',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        requestDate: Date.now() - (45 * 60 * 1000), // 45 minutes ago
        lastUrl: 'https://canvas.mobile.edu/courses',
        status: 'pending',
        platform: 'iOS',
        browser: 'Safari Mobile',
        location: 'Australia',
        riskLevel: 'low',
        notes: 'Mobile device registration'
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
    } else if (minutes > 0) {
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

function extractBrowserInfo(userAgent) {
    let browser = 'Unknown';
    let platform = 'Unknown';
    
    // Extract browser
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
        browser = 'Chrome';
    } else if (userAgent.includes('Firefox')) {
        browser = 'Firefox';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        browser = userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'Safari Mobile' : 'Safari';
    } else if (userAgent.includes('Edg')) {
        browser = 'Edge';
    }
    
    // Extract platform
    if (userAgent.includes('Windows')) {
        platform = 'Windows';
    } else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) {
        platform = 'macOS';
    } else if (userAgent.includes('Linux')) {
        platform = 'Linux';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        platform = 'iOS';
    } else if (userAgent.includes('Android')) {
        platform = 'Android';
    }
    
    return { browser, platform };
}

function assessRiskLevel(request) {
    let riskScore = 0;
    
    // Check for suspicious patterns
    if (request.userAgent.length < 50) riskScore += 2;
    if (request.ip.startsWith('10.') || request.ip.startsWith('192.168.')) riskScore -= 1; // Local IPs are less risky
    if (request.location === 'Unknown') riskScore += 1;
    if (request.platform === 'Linux') riskScore += 1; // Slightly higher risk
    if (request.name.length < 5) riskScore += 1;
    
    // Check for multiple requests from same IP (simulation)
    const sameIpRequests = pendingRequests.filter(r => r.ip === request.ip);
    if (sameIpRequests.length > 2) riskScore += 2;
    
    if (riskScore <= 1) return 'low';
    if (riskScore <= 3) return 'medium';
    return 'high';
}

function processRequests(requests, filters = {}) {
    let filteredRequests = [...requests];
    
    // Apply search filter
    if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredRequests = filteredRequests.filter(req => 
            req.name.toLowerCase().includes(searchTerm) ||
            req.hwid.toLowerCase().includes(searchTerm) ||
            req.ip.includes(searchTerm) ||
            req.lastUrl.toLowerCase().includes(searchTerm)
        );
    }
    
    // Apply time filter
    if (filters.timeframe && filters.timeframe !== 'all') {
        const now = Date.now();
        let cutoff;
        
        switch (filters.timeframe) {
            case 'today':
                cutoff = now - (24 * 60 * 60 * 1000);
                break;
            case 'week':
                cutoff = now - (7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoff = now - (30 * 24 * 60 * 60 * 1000);
                break;
            default:
                cutoff = 0;
        }
        
        filteredRequests = filteredRequests.filter(req => req.requestDate >= cutoff);
    }
    
    // Apply sorting
    if (filters.sort) {
        switch (filters.sort) {
            case 'newest':
                filteredRequests.sort((a, b) => b.requestDate - a.requestDate);
                break;
            case 'oldest':
                filteredRequests.sort((a, b) => a.requestDate - b.requestDate);
                break;
            case 'name':
                filteredRequests.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'risk':
                const riskOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                filteredRequests.sort((a, b) => riskOrder[b.riskLevel] - riskOrder[a.riskLevel]);
                break;
        }
    }
    
    // Format the requests
    return filteredRequests.map(req => {
        const browserInfo = extractBrowserInfo(req.userAgent);
        const riskLevel = assessRiskLevel(req);
        
        return {
            ...req,
            browser: browserInfo.browser,
            platform: browserInfo.platform,
            riskLevel: riskLevel,
            timeAgo: formatTimeAgo(req.requestDate),
            shortHwid: req.hwid.substring(0, 12) + '...',
            shortUserAgent: req.userAgent.substring(0, 50) + (req.userAgent.length > 50 ? '...' : '')
        };
    });
}

function logPendingAccess(ip, userAgent, filters) {
    const timestamp = new Date().toISOString();
    console.log(`[PENDING_REQUESTS] ${timestamp} - Accessed from ${ip}, filters:`, filters);
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
        
        // Parse query parameters
        const queryParams = event.queryStringParameters || {};
        const filters = {
            search: queryParams.search,
            timeframe: queryParams.timeframe || 'all',
            sort: queryParams.sort || 'newest',
            page: parseInt(queryParams.page) || 1,
            limit: Math.min(parseInt(queryParams.limit) || 20, CONFIG.MAX_RESULTS)
        };
        
        // Process and filter requests
        const processedRequests = processRequests(pendingRequests, filters);
        
        // Implement pagination
        const startIndex = (filters.page - 1) * filters.limit;
        const endIndex = startIndex + filters.limit;
        const paginatedRequests = processedRequests.slice(startIndex, endIndex);
        
        const totalPages = Math.ceil(processedRequests.length / filters.limit);
        
        logPendingAccess(clientIP, userAgent, filters);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                requests: paginatedRequests,
                pagination: {
                    currentPage: filters.page,
                    totalPages: totalPages,
                    totalRequests: processedRequests.length,
                    hasNext: filters.page < totalPages,
                    hasPrev: filters.page > 1
                },
                summary: {
                    total: pendingRequests.length,
                    filtered: processedRequests.length,
                    lowRisk: processedRequests.filter(r => r.riskLevel === 'low').length,
                    mediumRisk: processedRequests.filter(r => r.riskLevel === 'medium').length,
                    highRisk: processedRequests.filter(r => r.riskLevel === 'high').length
                },
                timestamp: Date.now()
            })
        };
        
    } catch (error) {
        console.error('Get pending requests error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: 'Server error loading pending requests' 
            })
        };
    }
};
