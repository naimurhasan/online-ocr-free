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

// Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)) // Appending extension
  }
});

const upload = multer({ storage: storage });

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Import controllers
const ocrController = require('./src/controllers/ocrController');

// API Endpoints
app.post('/api/ocr', upload.single('file'), ocrController.processFile);
app.post('/api/ocr/batch', upload.array('files'), ocrController.processBatch);


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
