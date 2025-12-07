// index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Google Sheets setup using service account
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const jwtClient = new google.auth.JWT({
  email: process.env.GOOGLE_CLIENT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});
const sheets = google.sheets({ version: 'v4', auth: jwtClient });

// Nodemailer transporter (simple SMTP using username/password or app password)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.post('/webhook', async (req, res) => {
  try {
    const { name, email, phone, submittedAt } = req.body;
    if (!name || !email) {
      return res.status(400).send('Name and email are required');
    }
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    // Map columns: Timestamp | Name | Email | Phone | Source
    const row = [submittedAt || new Date().toISOString(), name, email, phone || '', 'Web Form'];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
    const mailOptions = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Thanks for signing up — NxtWave',
      text: `Hi ${name},\n\nThanks for signing up! We received your details and will be in touch soon.\n\n— NxtWave Team`,
      html: `<p>Hi ${name},</p><p>Thanks for signing up! We received your details and will be in touch soon.</p><p>— <strong>NxtWave Team</strong></p>`
    };

    await transporter.sendMail(mailOptions);
    const notifyOptions = {
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER, // change if you want another address
      subject: `New Lead: ${name}`,
      text: `New lead:\nName: ${name}\nEmail: ${email}\nPhone: ${phone || 'N/A'}\nSubmittedAt: ${submittedAt}`,
    };
    await transporter.sendMail(notifyOptions);

    return res.status(200).json({ ok: true, message: 'Saved and email sent' });
  } catch (err) {
    console.error('Webhook error', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/', (req, res) => res.send('Webhook server running'));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
