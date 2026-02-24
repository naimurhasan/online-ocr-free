require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { v4: uuidv4 } = require('uuid');

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    // secure unique filename
    cb(null, uuidv4() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Import controllers
const ocrController = require('./src/controllers/ocrController');
const emailController = require('./src/controllers/emailController');

// API Endpoints
app.get('/api/config', (req, res) => {
  const maxThreads = Math.max(1, parseInt(process.env.MAX_CONCURRENT_THREADS || '4', 10));
  const defaultPrompt = 'You are an OCR engine. Extract all readable text from this image.\nRules:\n- {{FORMAT_INSTRUCTION}}\n- Do not translate text.\nLanguage hint: {{LANGUAGE_HINT}}.';
  res.json({ maxConcurrentThreads: maxThreads, defaultPrompt });
});

app.post('/api/ocr', upload.single('file'), ocrController.processFile);
app.post('/api/ocr/batch', upload.array('files'), ocrController.processBatch);
app.post('/api/download-zip', ocrController.downloadZip);

app.post('/api/otp/send', emailController.sendOtp);
app.post('/api/otp/verify', emailController.verifyOtp);
app.post('/api/job/create', (req, res, next) => {
  upload.array('files')(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }
    next();
  });
}, emailController.createJob);
app.get('/api/job/:id/status', emailController.getJobStatus);

// Start job worker
const jobWorker = require('./src/services/jobWorker');

app.listen(port, async () => {
  console.log(`Server is running at http://localhost:${port}`);
  await jobWorker.recoverStuckJobs();
  jobWorker.start();
  jobWorker.startCleanupSchedule();
});
