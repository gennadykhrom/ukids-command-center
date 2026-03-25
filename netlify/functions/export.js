const { google } = require('googleapis');

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '';
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!clientEmail || !privateKey || !spreadsheetId) {
        return { statusCode: 500, body: JSON.stringify({ error: "Отсутствуют ключи доступа к Google Sheets" }) };
    }

    try {
        const body = JSON.parse(event.body);
        const sheetName = body.sheetName || 'Выгрузка_Отчет';
        const dataRows = body.data || [];

        if (!dataRows.length) {
            return { statusCode: 400, body: JSON.stringify({ error: "Нет данных для выгрузки" }) };
        }

        const auth = new google.auth.GoogleAuth({
            credentials: { client_email: clientEmail, private_key: privateKey },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const sheets = google.sheets({ version: 'v4', auth });

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
        }

        const timeHeader = [['', '', ''], ['---', `Выгрузка от: ${new Date().toLocaleString('ru')}`, '---']];
        const rowsToInsert = [...timeHeader, ...dataRows];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:C`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: rowsToInsert }
        });

        return { statusCode: 200, body: JSON.stringify({ success: true, count: dataRows.length }) };

    } catch (e) {
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
