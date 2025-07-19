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
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { keyCode } = JSON.parse(event.body);
    
    console.log('Validating key:', keyCode);
    
    // TODO: Query your actual database here
    // Example database query:
    // const keyExists = await checkKeyInDatabase(keyCode);
    
    // For now, accept any key that matches admin-generated pattern
    const validPatterns = [
      /^LMS-AI-2025-[A-Z0-9]{8}$/,  // Original format
      /^TEST-2025-[A-Z0-9]{6}$/,    // Your admin format
      /^[A-Z]+-2025-[A-Z0-9]{6,8}$/ // Flexible format
    ];
    
    const isValidFormat = validPatterns.some(pattern => pattern.test(keyCode));
    
    if (isValidFormat) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          message: 'Valid license key',
          userData: {
            name: 'Licensed User',
            email: 'user@example.com',
            type: 'STANDARD',
            expiry: '2025-12-31',
            active: true,
            encryptionKey: 'validated-key-2025'
          }
        })
      };
    }
    
    // Check hardcoded fallback keys
    const fallbackKeys = ['DEMO-2025-TEST', 'ADMIN-2025-MASTER'];
    if (fallbackKeys.includes(keyCode)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          message: 'Valid fallback key',
          userData: {
            name: 'Fallback User',
            expiry: '2025-12-31',
            active: true
          }
        })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: false,
        message: 'Invalid license key'
      })
    };

  } catch (error) {
    console.error('Validation error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        valid: false,
        message: 'Validation service error'
      })
    };
  }
};
