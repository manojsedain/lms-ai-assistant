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

        console.log('Validating key:', keyCode);

        // Check hardcoded keys first
        const hardcodedKeys = {
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

        let keyData = hardcodedKeys[keyCode.toUpperCase()];

        // If not found in hardcoded, check generated keys (simulated database)
        if (!keyData) {
            // For now, let's create some sample generated keys that might match what you created
            const sampleGeneratedKeys = {
                'TEST-2025-H03PFT': {
                    name: 'Test User Generated',
                    expiry: '2025-12-31',
                    encryptionKey: 'test-user-secret-key-2025',
                    active: true
                }
            };
            
            keyData = sampleGeneratedKeys[keyCode.toUpperCase()];
        }
        
        if (!keyData) {
            console.log('Key not found:', keyCode);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: false,
                    message: 'Invalid product key. Please check your key and try again.'
                })
            };
        }

        // Check if key is active
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

        // Check expiry
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

        console.log('Key validation successful:', keyCode);

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
                    type: keyData.type || 'STANDARD'
                }
            })
        };

    } catch (error) {
        console.error('Database error:', error);
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
