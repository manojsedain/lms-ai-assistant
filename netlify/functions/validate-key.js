// netlify/functions/validate-key.js
exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { licenseKey } = JSON.parse(event.body);
    
    console.log('[Netlify] Validating key:', licenseKey);
    
    if (!licenseKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ valid: false, message: 'License key required' })
      };
    }

    // Method 1: Check environment variables (you can set these in Netlify dashboard)
    const envKeys = process.env.VALID_KEYS ? JSON.parse(process.env.VALID_KEYS) : {};
    
    // Method 2: Hardcoded keys (for testing)
    const hardcodedKeys = {
      'DEMO-2025-TEST': {
        name: 'Demo User',
        email: 'demo@example.com',
        expiry: '2025-12-31',
        type: 'DEMO',
        active: true
      }
    };

    // Method 3: Pattern-based validation for LMS-AI keys
    const lmsPattern = /^LMS-AI-2025-[A-Z0-9]{8}$/;
    if (lmsPattern.test(licenseKey)) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          message: 'Valid LMS-AI license key',
          user: {
            name: 'LMS AI User',
            email: 'user@lms-ai.com',
            expiry: '2025-12-31',
            type: 'STANDARD',
            active: true
          }
        })
      };
    }

    // Check environment keys first, then hardcoded
    const allKeys = { ...hardcodedKeys, ...envKeys };
    const keyData = allKeys[licenseKey];
    
    if (!keyData) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: false,
          message: 'Invalid license key'
        })
      };
    }

    // Validate key status and expiry
    if (!keyData.active) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: false,
          message: 'License key deactivated'
        })
      };
    }

    const today = new Date();
    const expiry = new Date(keyData.expiry);
    
    if (today > expiry) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: false,
          message: 'License key expired'
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: true,
        message: 'License validated successfully',
        user: keyData
      })
    };

  } catch (error) {
    console.error('[Netlify] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        valid: false,
        message: 'Server error'
      })
    };
  }
};
