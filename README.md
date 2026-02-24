# OCR Magic

OCR service for Bangla, English, and 60+ languages. Supports Tesseract (free), Google Vision API, and OpenRouter AI models.

## Features

- **Multiple OCR Engines** — Tesseract (free/local), Google Vision API, Gemma 3 27B, Mistral Small 3.1, or any custom OpenRouter model
- **50+ Languages** — Bengali, English, Hindi, Arabic, Chinese, Japanese, Korean, and more. Multi-language combos supported (e.g. `eng+ben`)
- **Batch Processing** — Queue multiple files and process them concurrently with configurable thread count
- **PDF Support** — Multi-page PDFs with optional page range selection, converted at 300 DPI
- **Column Splitting** — Split pages into 1–7 columns with draggable dividers for multi-column layouts
- **Image Preprocessing** — Grayscale, sharpening, and thresholding pipelines optimized for Bangla OCR
- **Preview Panel** — Zoom, pan, and rotate images/PDFs before processing
- **Background Jobs via Email** — Verify email with OTP, upload files, get results as a ZIP download link
- **Export Options** — Combined text file, ZIP archive, or copy to clipboard
- **Custom AI Prompts** — Custom extraction prompts for OpenRouter models
- **Bangla Text Cleaning** — Rule-based post-OCR corrections for common Bengali character misreads
- **Dark/Light Theme** — Toggle with system preference detection

## Tech Stack

- **Backend:** Node.js + Express
- **OCR:** Tesseract.js, Google Vision API, OpenRouter
- **Database:** Supabase (OTP storage)
- **Email:** Nodemailer + Gmail SMTP
- **Frontend:** Vanilla JS, PDF.js

## Local Development

### Prerequisites

- Node.js 18+
- `poppler-utils` (for PDF → image conversion)

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt install poppler-utils
```

### Setup

```bash
git clone <your-repo-url>
cd ocr-bangla-node
npm install
```

Create a `.env` file:

```env
PORT=3000
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS="your-app-password"
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
DATABASE_URL=postgresql://postgres.your-project-ref:your-password@aws-0-region.pooler.supabase.com:6543/postgres
MAX_CONCURRENT_THREADS=5
```

> **SUPABASE_SERVICE_KEY:** Go to Supabase Dashboard > Settings > API > `service_role` key. Required for file storage uploads.
> **DATABASE_URL:** Go to Supabase Dashboard > Settings > Database > Connection string > URI. Use the pooler connection (port 6543).

> **Gmail App Password:** Go to Google Account > Security > 2-Step Verification > App Passwords. Generate one for "Mail".

### Database Setup (Supabase)

```bash
# Login to Supabase CLI
npx supabase login

# Link to your project (find ref in Supabase dashboard URL)
npx supabase link --project-ref <your-project-ref>

# Push migrations
npx supabase db push
```

### Run

```bash
npm run dev
```

Open `http://localhost:3000`

### Dev Mode OTP

When `OCR_DEV_OTP=true` is set in `.env`, OTP emails are **not sent**. The code is always `999999` and logged to the console. Remove this variable or set it to `false` in production to enable real OTP emails.

---

## VPS Deployment

### 1. Server Setup

```bash
# SSH into your VPS
ssh user@your-server-ip

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install poppler for PDF support
sudo apt install -y poppler-utils

# Install PM2 for process management
sudo npm install -g pm2
```

### 2. Clone & Install

```bash
git clone <your-repo-url>
cd ocr-bangla-node
npm install --production
```

### 3. Environment Variables

```bash
cp .env.example .env
nano .env
# Fill in your SMTP, Supabase credentials
```

### 4. Database Migration

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### 5. Start with PM2

```bash
pm2 start app.js --name ocr-magic
pm2 save
pm2 startup  # follow the printed command to enable auto-start on reboot
```

### 6. Nginx Reverse Proxy (Optional)

```bash
sudo apt install nginx
```

Create `/etc/nginx/sites-available/ocr-magic`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/ocr-magic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Useful Commands

```bash
# Logs
pm2 logs ocr-magic

# Restart
pm2 restart ocr-magic

# Update code
git pull && npm install && pm2 restart ocr-magic

# Supabase: create a new migration
npx supabase migration new <migration-name>

# Supabase: push pending migrations
npx supabase db push
```

## Project Structure

```
ocr-bangla-node/
  app.js                  # Express server + job worker startup
  src/
    controllers/
      ocrController.js    # OCR + ZIP endpoints (browser-based)
      emailController.js  # OTP, verify, job creation endpoints
    services/
      ocrService.js       # OCR engine logic
      jobWorker.js        # Background job processor (polls Supabase)
    utils/
      emailService.js     # Nodemailer (OTP + results email)
      supabaseClient.js   # Supabase client (service role)
      fileUtils.js        # File cleanup
      textUtils.js        # Text post-processing
  public/                 # Frontend (static)
    index.html
    js/main.js
    css/style.css
  supabase/
    migrations/           # Database migrations (otp_codes, ocr_jobs, storage)
  tessdata/               # Tesseract language files
```
