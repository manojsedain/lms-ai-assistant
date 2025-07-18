exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

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
        const { keyCode } = JSON.parse(event.body);
        
        if (!keyCode) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    valid: false, 
                    message: 'Please enter a product key' 
                })
            };
        }

        // Hardcoded test keys for now (until database is connected)
        const testKeys = {
            'DEMO-2025-TEST': {
                name: 'Demo User',
                expiry: '2025-12-31',
                encryptionKey: 'demo-secret-key-2025',
                active: true
            },
            'ADMIN-2025-MASTER': {
                name: 'Administrator',
                expiry: '2099-12-31',
                encryptionKey: 'admin-master-key-2025',
                active: true
            },
            'JOHN-2025-ABC123': {
                name: 'John Smith',
                expiry: '2025-12-31',
                encryptionKey: 'john-secret-key-2025',
                active: true
            }
        };

        const keyData = testKeys[keyCode.toUpperCase()];
        
        if (!keyData) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: false,
                    message: 'Invalid product key. Please check your key and try again.'
                })
            };
        }

        if (!keyData.active) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: false,
                    message: 'This key has been deactivated. Please contact support.'
                })
            };
        }

        const today = new Date();
        const expiryDate = new Date(keyData.expiry);
        
        if (today > expiryDate) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: false,
                    message: 'This key has expired. Please renew your license.'
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                valid: true,
                message: 'Valid key! Preparing your personalized script...',
                userData: {
                    name: keyData.name,
                    expiry: keyData.expiry,
                    encryptionKey: keyData.encryptionKey,
                    type: 'STANDARD'
                }
            })
        };

    } catch (error) {
        console.error('Validation error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                valid: false,
                message: 'Server error. Please try again later.'
            })
        };
    }
};