exports.handler = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: '🎉 Netlify Functions are working perfectly!',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production',
            path: event.path,
            method: event.httpMethod,
            functions_available: [
                'test',
                'validate-key',
                'create-key', 
                'delete-key',
                'list-keys',
                'update-key'
            ],
            database_url: process.env.DATABASE_URL ? 'Configured' : 'Not set',
            status: 'All systems operational'
        })
    };
};
