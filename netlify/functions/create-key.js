exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { keyCode, userName, adminPassword } = body;
        
        // Simple admin check
        if (adminPassword !== 'admin2025') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false,
                    message: 'Unauthorized' 
                })
            };
        }

        // For now, just return success (no actual database)
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Key created successfully (simulated)',
                key: {
                    keyCode: keyCode,
                    userName: userName,
                    timestamp: new Date().toISOString()
                }
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Server error: ' + error.message
            })
        };
    }
};