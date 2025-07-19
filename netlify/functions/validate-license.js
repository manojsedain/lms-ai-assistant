exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    
    // Simple validation logic (enhance as needed)
    const isValidLicense = data.licenseKey && 
                          data.licenseKey.includes('LMS-AI-2025');
    
    if (isValidLicense) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          valid: true,
          decryptionKey: 'server-validated-key-' + Date.now(),
          message: 'License validated successfully'
        })
      };
    } else {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          valid: false,
          message: 'Invalid license key'
        })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        valid: false,
        error: 'Validation error',
        message: error.message 
      })
    };
  }
};
