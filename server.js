const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 4000;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// ✅ ให้ Express เสิร์ฟไฟล์ในโฟลเดอร์ `uploads/`
app.use('/uploads', express.static(UPLOADS_DIR));

// ✅ หน้าหลัก: แสดงรายการไฟล์เสียง
app.get('/', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).send('เกิดข้อผิดพลาดในการอ่านไฟล์');
    }

    let fileListHtml = files
      .filter(file => file.endsWith('.wav')) // ✅ เอาเฉพาะไฟล์ .wav
      .map(file => `<li><a href="/uploads/${file}" target="_blank">${file}</a> | <audio controls><source src="/uploads/${file}" type="audio/wav"></audio></li>`)
      .join('');

    res.send(`
      <h2>📂 รายการไฟล์เสียง</h2>
      <ul>${fileListHtml}</ul>
    `);
  });
});

// ✅ เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
