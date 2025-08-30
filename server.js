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

      // ついでにログ（任意）
      const logDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
      fs.appendFileSync(path.join(logDir, 'apply.csv'),
        `"${new Date().toISOString()}","${f.name}","${f.email}","${f.phone}","${(f.category||'').replace(/"/g,'""')}"\n`
      );

      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, error: 'send_failed' });
    }
  }
);

app.listen(PORT, () => console.log(`Form server on http://localhost:${PORT}`));