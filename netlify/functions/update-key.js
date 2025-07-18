exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { keyCode, active, adminPassword } = JSON.parse(event.body);
        
        // Simple admin authentication
        if (adminPassword !== 'admin2025') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false,
                    message: 'Unauthorized access' 
                })
            };
        }

        if (!keyCode) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Key code is required'
                })
            };
        }

        // For now, simulate update success
        console.log(`Simulating update of key: ${keyCode}, active: ${active}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Key ${keyCode} updated successfully (simulated)`,
                keyCode: keyCode,
                active: active
            })
        };

    } catch (error) {
        console.error('Update key error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to update key: ' + error.message
            })
        };
    }
};