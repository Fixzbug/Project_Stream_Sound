//📥 รับ UDP audio จาก ESP32
//🛠️ ต่อคิวไม่ให้บันทึกซ้อนกัน
//🔊 ขยายเสียง (amplify)
//💾 บันทึกเป็น .wav ในโฟลเดอร์ uploads/
//🏷️ ตั้งชื่อไฟล์ตาม device (เช่น sound_XXXXXXXXXXXX.wav)
//🕰️ (ตัวเลือก) ถ้าจะกลับมาใช้ timestamp ให้ไปเปิด getTimestamp() ได้.
//✅ ชื่อ device เป็น "sound-XXXXXXXXXXXX" (จาก ChipID).
//✅ ส่งผ่าน UDP ในช่องชื่อ (64 bytes แรกของ packet).
//✅ ส่งข้อมูลเสียงตามหลังชื่อ.
//✅ ใช้ AGC ขยายเสียงก่อนส่ง.
//✅ Server สามารถเอาชื่อ device ไปใช้ตั้งชื่อไฟล์ .wav ได้เลย.


const dgram = require('dgram');  // ✅ ใช้สำหรับสร้าง UDP server
const fs = require('fs');  // ✅ สำหรับอ่าน/เขียนไฟล์
const path = require('path');  // ✅ สำหรับจัดการ path ไฟล์
const wav = require('wav');  // ✅ สำหรับเขียนไฟล์ .wav

const INACTIVITY_TIMEOUT = 3000;  // ✅ ถ้าไม่ได้รับข้อมูลจาก device ภายใน 3 วินาที ถือว่า stream จบ
const AMPLIFY_GAIN = 8;  // ✅ ค่า gain สำหรับขยายเสียง 8 เท่า

const UPLOADS_DIR = path.join(__dirname, 'uploads');  // ✅ โฟลเดอร์เก็บไฟล์เสียง

// ✅ สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
  console.log(`Created directory: ${UPLOADS_DIR}`);
}

const devices = new Map();  // ✅ เก็บข้อมูลเสียงของแต่ละ device ตามชื่อ
const saveQueue = [];  // ✅ Queue สำหรับรอการบันทึกไฟล์เสียง
let isSaving = false;  // ✅ ตรวจสอบว่าตอนนี้กำลังบันทึกไฟล์อยู่ไหม (ป้องกันการบันทึกซ้อน)

console.log("Starting UDP server...");

const audioServer = dgram.createSocket('udp4');  // ✅ สร้าง UDP server

audioServer.on('message', (msg, rinfo) => {
  // ✅ อ่านชื่อ device จาก 64 bytes แรก
  const deviceName = msg.toString('utf-8', 0, 64).replace(/\0/g, '');
  // ✅ ข้อมูลเสียงอยู่หลังจาก 64 bytes แรก
  const audioData = msg.subarray(64);

  // ✅ ถ้ายังไม่เคยเจอ device นี้ ให้สร้าง buffer เก็บข้อมูล
  if (!devices.has(deviceName)) {
    devices.set(deviceName, {
      chunks: [],
      timeout: null
    });
    console.log(`New device detected: ${deviceName}`);
  }

  const device = devices.get(deviceName);
  device.chunks.push(Buffer.from(audioData));  // ✅ เพิ่มข้อมูลเสียงลงใน buffer

  // ✅ รีเซ็ต timeout (เพื่อรอรับข้อมูลเพิ่ม)
  clearTimeout(device.timeout);
  device.timeout = setTimeout(() => {
    enqueueSave(deviceName, device.chunks);  // ✅ เมื่อหมดเวลา inactivity ให้เตรียมบันทึกไฟล์
    devices.delete(deviceName);  // ✅ ลบ device ออกจาก map
  }, INACTIVITY_TIMEOUT);
});

// ✅ เปิด UDP server ที่ port 12345
audioServer.bind(12345, () => {
  console.log(`UDP Server listening on port 12345`);
});

// ✅ เพิ่มงานบันทึกไฟล์เข้า queue
function enqueueSave(deviceName, chunks) {
  saveQueue.push({ deviceName, chunks });
  processQueue();
}

// ✅ จัดการ queue บันทึกทีละไฟล์ (ไม่ให้ซ้อนกัน)
function processQueue() {
  if (isSaving || saveQueue.length === 0) return;

  isSaving = true;
  const { deviceName, chunks } = saveQueue.shift();

  saveWavFile(deviceName, chunks, () => {
    isSaving = false;
    processQueue();  // ✅ ทำงานถัดไปใน queue
  });
}

// ✅ ฟังก์ชันขยายเสียง
function amplify(buffer, gain) {
  const view = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
  for (let i = 0; i < view.length; i++) {
    let amplified = view[i] * gain;
    if (amplified > 32767) amplified = 32767;  // ✅ จำกัดค่าสูงสุด
    if (amplified < -32768) amplified = -32768;  // ✅ จำกัดค่าต่ำสุด
    view[i] = amplified;
  }
}

// ✅ ฟังก์ชันสร้าง timestamp (ปัจจุบันไม่ได้ใช้แล้ว เพราะคอมเมนต์ไว้)
function getTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
}

// ✅ ฟังก์ชันบันทึกไฟล์ WAV ลงโฟลเดอร์ uploads/
function saveWavFile(deviceName, chunks, callback) {
  // ✅ ตั้งชื่อไฟล์เป็นชื่อ device เช่น sound_XXXXXXXXXXXX.wav
  const fileName = path.join(UPLOADS_DIR, `${deviceName}.wav`);
  const fileStream = fs.createWriteStream(fileName);

  const writer = new wav.Writer({
    channels: 1,  // ✅ Mono
    sampleRate: 16000,  // ✅ 16kHz
    bitDepth: 16  // ✅ 16-bit
  });

  console.log(`Saving ${fileName}...`);

  writer.pipe(fileStream);

  for (const chunk of chunks) {
    amplify(chunk, AMPLIFY_GAIN);  // ✅ ขยายเสียงก่อนบันทึก
    writer.write(chunk);  // ✅ เขียนลงไฟล์ WAV
  }

  writer.end(() => {
    console.log(`Saved ${fileName}`);
    callback();  // ✅ แจ้งว่าเสร็จแล้วให้ processQueue ทำงานต่อ
  });
}
