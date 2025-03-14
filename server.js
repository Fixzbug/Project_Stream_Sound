const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 45678;
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// ✅ ปิดแคชไฟล์เสียง
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res, path) => {
    if (path.endsWith('.wav')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Expires', '0');
      res.setHeader('Pragma', 'no-cache');
    }
  }
}));

// ✅ แสดงรายการไฟล์เสียง
app.get('/', (req, res) => {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err) {
      return res.status(500).send('เกิดข้อผิดพลาดในการอ่านไฟล์');
    }

    let fileListHtml = files
      .filter(file => file.endsWith('.wav')) 
      .map(file => {
        const timestamp = Date.now();
        return `<li>
                  <a href="/uploads/${file}?t=${timestamp}" target="_blank">${file}</a> 
                  <br><br><br> 
                  <audio controls>
                    <source src="/uploads/${file}?t=${timestamp}" type="audio/wav">
                  </audio>
                </li>`;
      })
      .join('');

    res.send(`
      <h2>📂 รายการไฟล์เสียง</h2>
      <ul>${fileListHtml}</ul>
    `);
  });
});

// ✅ เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running at :${PORT}`);
});
