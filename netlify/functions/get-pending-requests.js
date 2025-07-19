const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

function validateAdminToken(authHeader) {
    // Skip validation for now to test the database connection
    return true;
}

function formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    
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
    
    if (userAgent) {
        if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
            browser = 'Chrome';
        } else if (userAgent.includes('Firefox')) {
            browser = 'Firefox';
        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
            browser = userAgent.includes('iPhone') || userAgent.includes('iPad') ? 'Safari Mobile' : 'Safari';
        } else if (userAgent.includes('Edg')) {
            browser = 'Edge';
        }
        
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
    }
    
    return { browser, platform };
}

function assessRiskLevel(request) {
    let riskScore = 0;
    
    if (!request.user_agent || request.user_agent.length < 50) riskScore += 2;
    if (request.ip_address && (request.ip_address.startsWith('10.') || request.ip_address.startsWith('192.168.'))) riskScore -= 1;
    if (!request.name || request.name.length < 5) riskScore += 1;
    
    if (riskScore <= 1) return 'low';
    if (riskScore <= 3) return 'medium';
    return 'high';
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
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
        const authHeader = event.headers['authorization'];
        
        // Validate admin token (currently disabled for testing)
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
        
        // Get pending users from Supabase
        const { data: pendingUsers, error } = await supabase
            .from('pending_users')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        
        // Process and format the requests
        const processedRequests = (pendingUsers || []).map(req => {
            const browserInfo = extractBrowserInfo(req.user_agent);
            const riskLevel = assessRiskLevel(req);
            
            return {
                id: req.id,
                name: req.name,
                hwid: req.hwid,
                email: req.email || 'Not provided',
                ip: req.ip_address || 'Unknown',
                userAgent: req.user_agent || 'Unknown',
                requestDate: new Date(req.created_at).getTime(),
                lastUrl: req.request_url || 'Unknown',
                status: 'pending',
                platform: browserInfo.platform,
                browser: browserInfo.browser,
                location: 'Unknown',
                riskLevel: riskLevel,
                notes: req.notes || '',
                timeAgo: formatTimeAgo(req.created_at),
                shortHwid: req.hwid.substring(0, 12) + '...',
                shortUserAgent: (req.user_agent || '').substring(0, 50) + ((req.user_agent || '').length > 50 ? '...' : '')
            };
        });
        
        console.log(`[PENDING_REQUESTS] Loaded ${processedRequests.length} pending requests`);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                requests: processedRequests,
                pagination: {
                    currentPage: 1,
                    totalPages: 1,
                    totalRequests: processedRequests.length,
                    hasNext: false,
                    hasPrev: false
                },
                summary: {
                    total: processedRequests.length,
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
                message: 'Server error loading pending requests',
                error: error.message
            })
        };
    }
};
