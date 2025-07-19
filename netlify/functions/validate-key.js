exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ valid: false, message: 'Method not allowed' })
        };
    }

    try {
        const { licenseKey } = JSON.parse(event.body);
        
        if (!licenseKey) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    valid: false, 
                    message: 'License key is required' 
                })
            };
        }

        // TODO: Replace this with your actual database query
        // For now, let's simulate database lookup
        console.log('Looking up license key:', licenseKey);
        
        // Example database query (replace with your actual database)
        // const user = await db.collection('licenses').doc(licenseKey).get();
        
        // For testing, let's use a simple pattern check
        if (licenseKey.startsWith('LMS-AI-2025-')) {
            // Simulate successful database lookup
            const userData = {
                name: 'Database User',
                email: 'user@example.com',
                expiry: '2025-12-31',
                type: 'STANDARD',
                active: true
            };

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: true,
                    message: 'License key validated successfully',
                    user: userData
                })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: false,
                    message: 'Invalid license key format'
                })
            };
        }

    } catch (error) {
        console.error('Validation error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                valid: false,
                message: 'Internal server error during validation'
            })
        };
    }
};
