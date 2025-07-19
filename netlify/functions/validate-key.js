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

    // Method 1: Check environment variables for admin-generated keys
    // You can set ADMIN_KEYS in Netlify dashboard as JSON string
    let adminKeys = {};
    try {
      if (process.env.ADMIN_KEYS) {
        adminKeys = JSON.parse(process.env.ADMIN_KEYS);
      }
    } catch (e) {
      console.warn('Could not parse ADMIN_KEYS environment variable');
    }
    
    // Check if key exists in admin keys
    if (adminKeys[licenseKey]) {
      const keyData = adminKeys[licenseKey];
      
      // Validate key
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
      
      console.log('[Netlify] Valid admin key found:', licenseKey);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          message: 'License validated from Netlify database',
          user: keyData
        })
      };
    }

    // Method 2: Pattern-based validation for LMS-AI keys
    const lmsPattern = /^LMS-AI-2025-[A-Z0-9]{8}$/;
    if (lmsPattern.test(licenseKey)) {
      console.log('[Netlify] Valid LMS-AI pattern key:', licenseKey);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          message: 'Valid LMS-AI license key (pattern match)',
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

    // Key not found
    console.log('[Netlify] Key not found:', licenseKey);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        valid: false,
        message: 'Invalid license key - not found in database'
      })
    };

  } catch (error) {
    console.error('[Netlify] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        valid: false,
        message: 'Server error during validation'
      })
    };
  }
};
