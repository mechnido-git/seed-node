const nodemailer = require('nodemailer');
require("dotenv").config();

const sendGmail = async (destination, body, subject, file) => {
    return new Promise((resolve, reject)=>{
        const transporter = nodemailer.createTransport({
            host: "smtp.hostinger.com",
            secure: true,
            secureConnection: false,
            tls: {
                ciphers: "SSLv3",
            },
            requireTLS: true,
            port: 465,
            debug: true,
            connectionTimeout: 10000,
            auth: {
                user: process.env.SENDEREMAIL,
                pass: process.env.SENDERPASS,
            },
        });
    
        var mailOptions = {
            from: process.env.SENDEREMAIL,
            to: destination,
            subject: subject,
            html: body,
            attachments: file? [
                {
                    path: file
                }
            ]: null
        };
    
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                console.log(error);
                reject(error)
            } else {
                console.log('Email sent: ' + info.response);
                resolve(true)
            }
        });
    })
}

module.exports = { sendGmail }