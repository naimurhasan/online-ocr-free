const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

transporter.verify().then(() => {
    console.log('✅ SMTP transporter ready');
}).catch(err => {
    console.error('❌ SMTP transporter verify failed:', err.message);
});

exports.sendOTP = async (to, code) => {
    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">OCR Magic — Verification Code</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Use this code to verify your email and receive OCR results.</p>
        <div style="background: #ffffff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111827;">${code}</span>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">This code expires in 5 minutes. If you didn't request this, ignore this email.</p>
    </div>`;

    await transporter.sendMail({
        from: `"OCR Magic" <${process.env.SMTP_USER}>`,
        to,
        subject: `${code} — Your OCR Magic Verification Code`,
        html,
    });
};

exports.sendResults = async (to, downloadUrl, format = 'zip') => {
    const isPdf = format === 'pdf';
    const btnLabel = isPdf ? 'Open Results (PDF-ready)' : 'Download Results (.zip)';
    const description = isPdf
        ? 'Your files have been processed. Open the link below and use "Print → Save as PDF" to save your results.'
        : 'Your files have been processed. Download the results using the link below.';

    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Your OCR Results are Ready</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">${description}</p>
        <div style="text-align: center; margin-bottom: 16px;">
            <a href="${downloadUrl}" style="display: inline-block; padding: 12px 32px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">${btnLabel}</a>
        </div>
        <p style="color: #6b7280; font-size: 12px; margin: 0 0 4px;">If the button above doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 11px; margin: 0 0 16px; word-break: break-all;"><a href="${downloadUrl}" style="color: #3b82f6;">${downloadUrl}</a></p>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">This link expires in 7 days. Sent from OCR Magic.</p>
    </div>`;

    await transporter.sendMail({
        from: `"OCR Magic" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your OCR Results are Ready — OCR Magic',
        html,
    });
};
