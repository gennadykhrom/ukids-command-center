const { google } = require('googleapis');

exports.handler = async function(event, context) {
    const methods = ['GET', 'POST'];
    if (!methods.includes(event.httpMethod)) return { statusCode: 405, body: 'Method Not Allowed' };

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
        return { statusCode: 500, body: JSON.stringify({ error: "Отсутствуют ключи доступа к Google Sheets" }) };
    }

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: clientEmail, private_key: privateKey },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    const sheetName = 'Промпты';

    if (event.httpMethod === 'GET') {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId, 
                range: `${sheetName}!A:B`
            });
            const rows = response.data.values || [];
            const prompts = {};
            
            let startIndex = 0;
            if (rows.length > 0 && rows[0][0] === 'Субагент') startIndex = 1;

            for (let i = startIndex; i < rows.length; i++) {
                if (rows[i][0] && rows[i][1]) prompts[rows[i][0]] = rows[i][1];
            }
            return { statusCode: 200, body: JSON.stringify({ prompts }) };
        } catch (e) {
            return { statusCode: 200, body: JSON.stringify({ prompts: {} }) };
        }
    }

    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body);
            const agent = body.agent;
            const prompt = body.prompt;
            
            if (!agent || !prompt) return { statusCode: 400, body: JSON.stringify({ error: "Нет агента или текста промпта" }) };

            let sheetExists = true;
            try {
                await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A1` });
            } catch(e) {
                sheetExists = false;
            }

            if (!sheetExists) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [{
                            addSheet: { properties: { title: sheetName } }
                        }]
                    }
                });
                await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${sheetName}!A:B`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: { values: [['Субагент', 'Текст промпта'], [agent, prompt]] }
                });
                return { statusCode: 200, body: JSON.stringify({ success: true, newSheetCreated: true }) };
            }

            const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!A:B` });
            const rows = res.data.values || [];
            const rowIndex = rows.findIndex(r => r[0] === agent);

            if (rowIndex !== -1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!A${rowIndex + 1}:B${rowIndex + 1}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [[agent, prompt]] }
                });
            } else {
                await sheets.spreadsheets.values.append({
                    spreadsheetId,
                    range: `${sheetName}!A:B`,
                    valueInputOption: 'USER_ENTERED',
                    insertDataOption: 'INSERT_ROWS',
                    requestBody: { values: [[agent, prompt]] }
                });
            }

            return { statusCode: 200, body: JSON.stringify({ success: true }) };
        } catch (e) {
            return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
        }
    }
};
