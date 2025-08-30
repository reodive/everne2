import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { body, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors({
  origin: process.env.FRONT_ORIGIN?.split(',') ?? true
}));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 } // 8MB × 5枚
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

// API: 応募受付
// 保存先準備
const DATA_DIR = path.join(process.cwd(), 'data');
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const LOG_DIR = path.join(process.cwd(), 'logs');
for (const dir of [DATA_DIR, UPLOAD_DIR, LOG_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 管理用トークン検証（未設定ならパス）
const checkAdmin = (req, res, next) => {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return next();
  const provided = req.headers['x-admin-token'];
  if (provided === token) return next();
  return res.status(401).json({ ok: false, error: 'unauthorized' });
};

app.post(
  '/api/apply',
  upload.array('photos', 5),
  [
    body('name').trim().notEmpty().withMessage('氏名は必須'),
    body('email').isEmail().withMessage('メール形式が不正'),
    body('phone').trim().notEmpty().withMessage('電話は必須'),
    body('agree').equals('true').withMessage('同意が必要')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ ok: false, errors: errors.array() });

    const f = req.body; // name, kana, age, height, category, message など
    const files = req.files ?? [];

    // 画像を保存
    const savedFiles = [];
    for (const file of files) {
      const safeName = `${Date.now()}_${file.originalname}`.replace(/[^\w.\-]/g, '_');
      const abs = path.join(UPLOAD_DIR, safeName);
      fs.writeFileSync(abs, file.buffer);
      savedFiles.push({ filename: safeName, mimetype: file.mimetype, size: file.size, path: `uploads/${safeName}` });
    }

    // メール本文
    const text = [
      '【EVERNE 応募フォーム】',
      `氏名: ${f.name}`,
      `フリガナ: ${f.kana || ''}`,
      `メール: ${f.email}`,
      `電話: ${f.phone}`,
      `年齢: ${f.age || ''}`,
      `身長: ${f.height || ''}`,
      `カテゴリ: ${f.category || ''}`,
      '',
      '--- メッセージ ---',
      f.message || '(なし)'
    ].join('\n');

    try {
      await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to: process.env.MAIL_TO,
        subject: `【応募】${f.name} さんより`,
        text,
        attachments: files.map(file => ({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype
        }))
      });

      // CSVログ
      fs.appendFileSync(path.join(LOG_DIR, 'apply.csv'),
        `"${new Date().toISOString()}","${f.name}","${f.email}","${f.phone}","${(f.category||'').replace(/"/g,'""')}"\n`
      );

      // JSON Lines 保存（管理画面用）
      const record = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
        name: f.name,
        kana: f.kana || '',
        email: f.email,
        phone: f.phone,
        age: f.age || '',
        height: f.height || '',
        size: f.size || '',
        category: f.category || '',
        message: f.message || '',
        files: savedFiles
      };
      fs.appendFileSync(path.join(DATA_DIR, 'applications.jsonl'), JSON.stringify(record) + '\n');

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'send_failed' });
    }
  }
);

// 管理: 一覧取得（JSON）
app.get('/api/admin/applications', checkAdmin, (req, res) => {
  const file = path.join(DATA_DIR, 'applications.jsonl');
  if (!fs.existsSync(file)) return res.json({ ok: true, items: [] });
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\n+/).filter(Boolean);
  const items = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ ok: true, items });
});

// 管理: CSVダウンロード
app.get('/api/admin/applications.csv', checkAdmin, (req, res) => {
  const file = path.join(DATA_DIR, 'applications.jsonl');
  if (!fs.existsSync(file)) return res.send('createdAt,name,email,phone,category\n');
  const lines = fs.readFileSync(file, 'utf8').trim().split(/\n+/).filter(Boolean);
  const rows = ['createdAt,name,email,phone,category'];
  for (const l of lines) {
    try {
      const r = JSON.parse(l);
      rows.push([r.createdAt, r.name, r.email, r.phone, r.category].map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(','));
    } catch {}
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(rows.join('\n'));
});

// 保存したアップロードファイルを静的配信
app.use('/uploads', express.static(UPLOAD_DIR));

app.listen(PORT, () => console.log(`Form server on http://localhost:${PORT}`));
