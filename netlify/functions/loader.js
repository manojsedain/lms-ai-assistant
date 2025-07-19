// netlify/functions/loader.js
const crypto = require('crypto');

// Configuration
const CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key',
    SCRIPT_VERSION: '1.2.0',
    RATE_LIMIT_MAX: 50, // requests per hour per device
    RATE_LIMIT_WINDOW: 60 * 60 * 1000 // 1 hour
};

// In-memory storage (use real database in production)
const approvedUsers = new Map();
const rateLimitStore = new Map();
const accessLogs = [];

// Sample approved users (in production, load from database)
approvedUsers.set('hwid_abc123def456', {
    id: 'user_001',
    name: 'John Doe',
    hwid: 'hwid_abc123def456',
    approvedAt: Date.now() - (24 * 60 * 60 * 1000),
    status: 'active',
    lastAccess: Date.now() - (30 * 60 * 1000)
});

// Main AI script content (encrypted/obfuscated in production)
const MAIN_SCRIPT = `
// LMS AI Assistant - Main Script v${CONFIG.SCRIPT_VERSION}
(function() {
    'use strict';
    
    console.log('LMS AI Assistant v${CONFIG.SCRIPT_VERSION} loaded successfully');
    
    // Configuration
    const AI_CONFIG = {
        version: '${CONFIG.SCRIPT_VERSION}',
        apiEndpoint: 'https://wrongnumber.netlify.app/.netlify/functions/',
        features: {
            autoComplete: true,
            smartSuggestions: true,
            taskAutomation: true,
            analyticsTracking: true
        },
        updateCheckInterval: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    // Device fingerprinting
    function getDeviceInfo() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        
        return {
            hwid: localStorage.getItem('device_hwid') || 'unknown',
            userAgent: navigator.userAgent,
            screen: screen.width + 'x' + screen.height,
            timezone: new Date().getTimezoneOffset(),
            language: navigator.language,
            canvas: canvas.toDataURL(),
            timestamp: Date.now()
        };
    }
    
    // API communication
    async function makeAPICall(endpoint, data = {}) {
        const deviceInfo = getDeviceInfo();
        
        try {
            const response = await fetch(AI_CONFIG.apiEndpoint + endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-ID': deviceInfo.hwid,
                    'X-Script-Version': AI_CONFIG.version,
                    'X-Timestamp': deviceInfo.timestamp.toString()
                },
                body: JSON.stringify({
                    ...data,
                    deviceInfo: deviceInfo
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('AI API call failed:', error);
            return { success: false, error: error.message };
        }
    }
    
    // LMS Detection
    function detectLMS() {
        const hostname = window.location.hostname.toLowerCase();
        const pathname = window.location.pathname.toLowerCase();
        
        if (hostname.includes('canvas') || pathname.includes('canvas')) {
            return 'canvas';
        } else if (hostname.includes('blackboard') || pathname.includes('blackboard')) {
            return 'blackboard';
        } else if (hostname.includes('moodle') || pathname.includes('moodle')) {
            return 'moodle';
        } else if (hostname.includes('brightspace') || pathname.includes('brightspace')) {
            return 'brightspace';
        } else if (hostname.includes('schoology') || pathname.includes('schoology')) {
            return 'schoology';
        }
        
        return 'unknown';
    }
    
    // AI Assistant UI
    function createAssistantUI() {
        const assistantContainer = document.createElement('div');
        assistantContainer.id = 'lms-ai-assistant';
        assistantContainer.style.cssText = \`
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 50%;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
            cursor: pointer;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: white;
            transition: all 0.3s ease;
            user-select: none;
        \`;
        
        assistantContainer.innerHTML = '🤖';
        assistantContainer.title = 'LMS AI Assistant';
        
        assistantContainer.addEventListener('mouseenter', () => {
            assistantContainer.style.transform = 'scale(1.1)';
            assistantContainer.style.boxShadow = '0 6px 25px rgba(99, 102, 241, 0.4)';
        });
        
        assistantContainer.addEventListener('mouseleave', () => {
            assistantContainer.style.transform = 'scale(1)';
            assistantContainer.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.3)';
        });
        
        assistantContainer.addEventListener('click', toggleAssistantPanel);
        
        document.body.appendChild(assistantContainer);
        
        createAssistantPanel();
    }
    
    function createAssistantPanel() {
        const panel = document.createElement('div');
        panel.id = 'lms-ai-panel';
        panel.style.cssText = \`
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            height: 450px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            z-index: 999998;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: 'Segoe UI', sans-serif;
        \`;
        
        panel.innerHTML = \`
            <div style="padding: 20px; border-bottom: 1px solid rgba(0, 0, 0, 0.1);">
                <h3 style="margin: 0; color: #1e293b; font-size: 18px;">AI Assistant</h3>
                <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">LMS Helper v\${AI_CONFIG.version}</p>
            </div>
            <div style="flex: 1; padding: 20px; overflow-y: auto;">
                <div id="ai-features">
                    <div class="feature-item" style="margin-bottom: 15px; padding: 10px; background: rgba(99, 102, 241, 0.1); border-radius: 8px; cursor: pointer;">
                        <strong style="color: #6366f1;">📝 Smart Auto-Complete</strong>
                        <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">Intelligent form completion</p>
                    </div>
                    <div class="feature-item" style="margin-bottom: 15px; padding: 10px; background: rgba(139, 92, 246, 0.1); border-radius: 8px; cursor: pointer;">
                        <strong style="color: #8b5cf6;">💡 AI Suggestions</strong>
                        <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">Context-aware recommendations</p>
                    </div>
                    <div class="feature-item" style="margin-bottom: 15px; padding: 10px; background: rgba(6, 182, 212, 0.1); border-radius: 8px; cursor: pointer;">
                        <strong style="color: #06b6d4;">⚡ Task Automation</strong>
                        <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">Streamline repetitive tasks</p>
                    </div>
                    <div class="feature-item" style="margin-bottom: 15px; padding: 10px; background: rgba(16, 185, 129, 0.1); border-radius: 8px; cursor: pointer;">
                        <strong style="color: #10b981;">📊 Smart Analytics</strong>
                        <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">Performance insights</p>
                    </div>
                </div>
            </div>
            <div style="padding: 15px; border-top: 1px solid rgba(0, 0, 0, 0.1); background: rgba(248, 250, 252, 0.8);">
                <div style="font-size: 12px; color: #64748b; text-align: center;">
                    Status: <span style="color: #10b981; font-weight: bold;">Active</span> | 
                    LMS: <span id="detected-lms" style="color: #6366f1; font-weight: bold;">Loading...</span>
                </div>
            </div>
        \`;
        
        document.body.appendChild(panel);
        
        // Update detected LMS
        setTimeout(() => {
            const lms = detectLMS();
            const lmsElement = document.getElementById('detected-lms');
            if (lmsElement) {
                lmsElement.textContent = lms.charAt(0).toUpperCase() + lms.slice(1);
            }
        }, 500);
    }
    
    function toggleAssistantPanel() {
        const panel = document.getElementById('lms-ai-panel');
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
        }
    }
    
    // Initialize AI features based on detected LMS
    function initializeLMSFeatures() {
        const lmsType = detectLMS();
        
        switch (lmsType) {
            case 'canvas':
                initCanvasFeatures();
                break;
            case 'blackboard':
                initBlackboardFeatures();
                break;
            case 'moodle':
                initMoodleFeatures();
                break;
            case 'brightspace':
                initBrightspaceFeatures();
                break;
            default:
                initGenericFeatures();
        }
    }
    
    function initCanvasFeatures() {
        console.log('Initializing Canvas-specific AI features...');
        
        // Auto-complete for Canvas forms
        const textareas = document.querySelectorAll('textarea[data-rich_text="true"]');
        textareas.forEach(textarea => {
            addSmartAutoComplete(textarea);
        });
        
        // Quiz assistance
        if (window.location.pathname.includes('/quizzes/')) {
            initQuizAssistance();
        }
        
        // Assignment helper
        if (window.location.pathname.includes('/assignments/')) {
            initAssignmentHelper();
        }
    }
    
    function initBlackboardFeatures() {
        console.log('Initializing Blackboard-specific AI features...');
        // Blackboard-specific implementations
    }
    
    function initMoodleFeatures() {
        console.log('Initializing Moodle-specific AI features...');
        // Moodle-specific implementations
    }
    
    function initBrightspaceFeatures() {
        console.log('Initializing Brightspace-specific AI features...');
        // Brightspace-specific implementations
    }
    
    function initGenericFeatures() {
        console.log('Initializing generic LMS AI features...');
        // Generic LMS implementations
    }
    
    function addSmartAutoComplete(element) {
        if (!element || element.hasAttribute('data-ai-enhanced')) {
            return;
        }
        
        element.setAttribute('data-ai-enhanced', 'true');
        
        element.addEventListener('input', debounce(async (event) => {
            const text = event.target.value;
            if (text.length > 10) {
                const suggestions = await getAISuggestions(text);
                if (suggestions && suggestions.length > 0) {
                    showSuggestions(element, suggestions);
                }
            }
        }, 500));
    }
    
    async function getAISuggestions(text) {
        const response = await makeAPICall('ai-suggestions', { text });
        return response.success ? response.suggestions : [];
    }
    
    function showSuggestions(element, suggestions) {
        // Implementation for showing AI suggestions
        console.log('AI Suggestions:', suggestions);
    }
    
    function initQuizAssistance() {
        console.log('Quiz assistance activated');
        // Quiz-specific AI features
    }
    
    function initAssignmentHelper() {
        console.log('Assignment helper activated');
        // Assignment-specific AI features
    }
    
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Analytics tracking
    function trackUsage(action, data = {}) {
        makeAPICall('track-usage', {
            action,
            data,
            url: window.location.href,
            timestamp: Date.now()
        });
    }
    
    // Initialize the assistant
    function initializeAssistant() {
        // Check if already initialized
        if (window.lmsAIAssistant) {
            return;
        }
        
        window.lmsAIAssistant = {
            version: AI_CONFIG.version,
            initialized: true,
            togglePanel: toggleAssistantPanel
        };
        
        createAssistantUI();
        initializeLMSFeatures();
        
        // Track initialization
        trackUsage('assistant_initialized', {
            lms: detectLMS(),
            version: AI_CONFIG.version
        });
        
        console.log(\`LMS AI Assistant v\${AI_CONFIG.version} initialized successfully\`);
    }
    
    // Start initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAssistant);
    } else {
        initializeAssistant();
    }
    
})();
`;

function validateRequest(event) {
    const clientIP = event.headers['x-forwarded-for'] || event.headers['x-real-ip'] || 'unknown';
    const deviceId = event.headers['x-device-id'];
    const scriptVersion = event.headers['x-script-version'];
    const timestamp = event.headers['x-timestamp'];
    const userAgent = event.headers['user-agent'];
    
    // Validate required headers
    if (!deviceId || !timestamp) {
        return { valid: false, reason: 'Missing required headers' };
    }
    
    // Check timestamp (prevent replay attacks)
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    const timeDiff = Math.abs(now - requestTime);
    
    if (timeDiff > 300000) { // 5 minutes tolerance
        return { valid: false, reason: 'Request expired' };
    }
    
    // Check if device is approved
    if (!approvedUsers.has(deviceId)) {
        return { valid: false, reason: 'Device not approved' };
    }
    
    const user = approvedUsers.get(deviceId);
    if (user.status !== 'active') {
        return { valid: false, reason: 'User account inactive' };
    }
    
    // Check rate limiting
    const rateLimitKey = \`loader_\${deviceId}\`;
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
    
    return { valid: true, user, clientIP, userAgent };
}

function logScriptAccess(user, clientIP, userAgent) {
    const logEntry = {
        userId: user.id,
        userName: user.name,
        hwid: user.hwid,
        ip: clientIP,
        userAgent: userAgent,
        timestamp: Date.now(),
        version: CONFIG.SCRIPT_VERSION
    };
    
    accessLogs.push(logEntry);
    
    // Keep only last 1000 logs in memory
    if (accessLogs.length > 1000) {
        accessLogs.splice(0, 100);
    }
    
    console.log('[SCRIPT_ACCESS]', logEntry);
    
    // Update user's last access time
    user.lastAccess = Date.now();
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Device-ID, X-Script-Version, X-Timestamp',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/javascript',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }
    
    try {
        // Validate request
        const validation = validateRequest(event);
        
        if (!validation.valid) {
            console.log('[SCRIPT_ACCESS_DENIED]', validation.reason);
            return {
                statusCode: 403,
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: false, 
                    message: 'Access denied: ' + validation.reason 
                })
            };
        }
        
        // Log successful access
        logScriptAccess(validation.user, validation.clientIP, validation.userAgent);
        
        // Return the main script
        return {
            statusCode: 200,
            headers,
            body: MAIN_SCRIPT
        };
        
    } catch (error) {
        console.error('Loader error:', error);
        
        return {
            statusCode: 500,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                success: false, 
                message: 'Server error loading script' 
            })
        };
    }
};
