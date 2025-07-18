exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'DELETE, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'DELETE' && event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { keyCode, adminPassword } = JSON.parse(event.body);
        
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

        // For now, simulate deletion success
        // In real implementation, this would delete from database
        console.log(`Simulating deletion of key: ${keyCode}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Key ${keyCode} deleted successfully (simulated)`
            })
        };

    } catch (error) {
        console.error('Delete key error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to delete key: ' + error.message
            })
        };
    }
};