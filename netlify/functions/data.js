const { google } = require('googleapis');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
        
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_CLIENT_EMAIL,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.SPREADSHEET_ID;

        if (!spreadsheetId) {
            return { statusCode: 500, body: JSON.stringify({ error: 'SPREADSHEET_ID not configured' }) };
        }

        // Fetch spreadsheet info to get the first sheet name
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheetTitle = spreadsheet.data.sheets[0].properties.title;

        // Fetch data from the first sheet
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: sheetTitle,
        });

        const rows = response.data.values || [];
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                sheetName: sheetTitle,
                rowCount: rows.length,
                data: rows
            }),
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};
