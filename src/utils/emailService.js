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

exports.sendResults = async (to, downloadUrl) => {
    const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
        <h2 style="color: #1f2937; margin: 0 0 8px;">Your OCR Results are Ready</h2>
        <p style="color: #6b7280; margin: 0 0 24px; font-size: 14px;">Your files have been processed. Download the results using the link below.</p>
        <div style="text-align: center; margin-bottom: 24px;">
            <a href="${downloadUrl}" style="display: inline-block; padding: 12px 32px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Download Results (.zip)</a>
        </div>
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">This link expires in 7 days. Sent from OCR Magic.</p>
    </div>`;

    await transporter.sendMail({
        from: `"OCR Magic" <${process.env.SMTP_USER}>`,
        to,
        subject: 'Your OCR Results are Ready — OCR Magic',
        html,
    });
};
