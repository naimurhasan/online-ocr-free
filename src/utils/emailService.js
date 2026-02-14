const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

exports.sendEmail = async (to, results) => {
    return;
    try {
        let emailContent = '<h1>OCR Batch Processing Complete</h1>';
        emailContent += '<p>Here are the results of your batch processing:</p>';

        results.forEach(result => {
            emailContent += `<div style="margin-bottom: 20px; border: 1px solid #ccc; padding: 10px;">
        <h3>Filename: ${result.filename}</h3>
        <pre style="white-space: pre-wrap;">${result.text || result.error}</pre>
      </div>`;
        });

        const info = await transporter.sendMail({
            from: `"OCR Service" <${process.env.SMTP_USER}>`, // sender address
            to: to, // list of receivers
            subject: "Your OCR Batch Results", // Subject line
            html: emailContent, // html body
        });

        console.log("Message sent: %s", info.messageId);
    } catch (error) {
        console.error("Error sending email:", error);
    }
};
