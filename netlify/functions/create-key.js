// Simple in-memory storage for generated keys
let generatedKeys = {};

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
        const { keyCode, userName, expiryDate, encryptionKey, keyType, adminPassword } = JSON.parse(event.body);
        
        // Admin authentication
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

        // Store the key in memory
        generatedKeys[keyCode] = {
            name: userName,
            expiry: expiryDate,
            encryptionKey: encryptionKey,
            type: keyType,
            active: true,
            created: new Date().toISOString()
        };

        console.log('Key stored:', keyCode, generatedKeys[keyCode]);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Key created and stored successfully',
                key: {
                    keyCode: keyCode,
                    userName: userName,
                    expiryDate: expiryDate,
                    keyType: keyType
                }
            })
        };

    } catch (error) {
        console.error('Create key error:', error);
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

// Export keys for validate-key function to access
exports.getGeneratedKeys = () => generatedKeys;
