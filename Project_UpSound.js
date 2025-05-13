const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Uploads directory created.');
}

app.post('/upload', (req, res) => {
    const fileName = req.headers['x-file-name'] || 'unknown.wav';
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '');
    const filePath = path.join(uploadDir, safeFileName);

    if (fs.existsSync(filePath)) {
        console.log(`⚠️  Overwriting existing file: ${safeFileName}`);
    } else {
        console.log(`🆕  Saving new file: ${safeFileName}`);
    }

    const writeStream = fs.createWriteStream(filePath);
    req.pipe(writeStream);

    req.on('end', () => {
        res.send(`File uploaded successfully as ${safeFileName}`);
        console.log(`✅ File saved as ${safeFileName}`);
    });

    req.on('error', (err) => {
        console.error('❌ Error saving file:', err);
        res.status(500).send('Error saving file');
    });
});

const PORT = process.env.PORT || 0;
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${server.address().port}`);
});
