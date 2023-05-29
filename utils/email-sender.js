'use strict';
const gmailSend = require('gmail-send');
require("dotenv").config();

const SENDER_EMAIL = process.env.SENDEREMAIL;
const SENDER_PASS = process.env.SENDERPASS;

const sendGmail = async (destination, messageHtml, subject, files) => {

    console.log(SENDER_EMAIL+" "+SENDER_PASS);
    try {
        const send = gmailSend({
            html: messageHtml,
            user: SENDER_EMAIL,
            pass: SENDER_PASS,
            to: destination,
            subject,
            files,
        });
        const { result, full } = await send();
        console.log(result);
    } catch (error) {
        console.error('ERROR', error);
        throw error;
    }
}

module.exports = { sendGmail }