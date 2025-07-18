exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const adminPassword = event.queryStringParameters?.admin;
        
        if (adminPassword !== 'admin2025') {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({ 
                    success: false,
                    error: 'Unauthorized access' 
                })
            };
        }

        // Simulate database keys for now
        const simulatedKeys = [
            {
                key_code: 'DEMO-2025-TEST',
                user_name: 'Demo User',
                expiry_date: '2025-12-31',
                key_type: 'TEST',
                active: true,
                created_at: '2025-01-18T10:00:00.000Z',
                last_used: null,
                download_count: 0
            },
            {
                key_code: 'ADMIN-2025-MASTER',
                user_name: 'Administrator',
                expiry_date: '2099-12-31',
                key_type: 'ADMIN',
                active: true,
                created_at: '2025-01-18T10:00:00.000Z',
                last_used: '2025-01-18T12:00:00.000Z',
                download_count: 5
            },
            {
                key_code: 'JOHN-2025-ABC123',
                user_name: 'John Smith',
                expiry_date: '2025-12-31',
                key_type: 'STANDARD',
                active: true,
                created_at: '2025-01-18T10:00:00.000Z',
                last_used: null,
                download_count: 0
            }
        ];

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                keys: simulatedKeys,
                total: simulatedKeys.length
            })
        };

    } catch (error) {
        console.error('List keys error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                message: 'Failed to fetch keys: ' + error.message
            })
        };
    }
};