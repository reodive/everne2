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

// CORS: apply only to /api endpoints, allow same-origin automatically
const ALLOWED_ORIGINS = (process.env.FRONT_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const corsDelegate = (req, cb) => {
  // If no whitelist, allow all (dev-friendly)
  if (ALLOWED_ORIGINS.length === 0) return cb(null, { origin: true });
  const origin = req.headers.origin;
  const host = req.headers.host; // e.g., localhost:5174
  // Always allow same-origin and no-origin
  if (!origin || origin === `http://${host}` || origin === `https://${host}`) {
    return cb(null, { origin: true });
  }
  // Allow explicitly whitelisted origins
  if (ALLOWED_ORIGINS.includes(origin)) return cb(null, { origin: true });
  return cb(new Error('Not allowed by CORS'));
};
app.use('/api', cors(corsDelegate));
app.options('/api/*', cors(corsDelegate));
app.use(express.json());

// リクエスト簡易ログ（デバッグ用）
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

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
const NEWS_FILE = path.join(DATA_DIR, 'news.json');
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json');

const readJson = (file, fallback) => {
  try { if (!fs.existsSync(file)) return fallback; return JSON.parse(fs.readFileSync(file, 'utf8') || ''); } catch { return fallback; }
};
const writeJson = (file, data) => { fs.writeFileSync(file, JSON.stringify(data, null, 2)); };
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2,8)}`;

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

    let mailStatus = 'skipped';
    try {
      // 送信設定が揃っていない場合はメール送信をスキップ
      if (process.env.SMTP_HOST && process.env.MAIL_TO && process.env.MAIL_FROM) {
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
        mailStatus = 'sent';
      }

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
        files: savedFiles,
        mailStatus
      };
      fs.appendFileSync(path.join(DATA_DIR, 'applications.jsonl'), JSON.stringify(record) + '\n');

      res.json({ ok: true, mailStatus });
    } catch (err) {
      console.error(err);
      // メール送信や保存のどこかで失敗
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  }
);

// -------- News APIs --------
// Public: list news
app.get('/api/news', (_req, res) => {
  const items = readJson(NEWS_FILE, []);
  const filtered = items.filter(n => n.active !== false).sort((a,b) => new Date(b.date||b.createdAt) - new Date(a.date||a.createdAt));
  res.json({ ok: true, items: filtered });
});
// Admin: list
app.get('/api/admin/news', checkAdmin, (_req, res) => {
  const items = readJson(NEWS_FILE, []);
  res.json({ ok: true, items });
});
// Admin: create
app.post('/api/admin/news', checkAdmin, (req, res) => {
  const items = readJson(NEWS_FILE, []);
  const { title, summary = '', date = new Date().toISOString().slice(0,10), link = '', active = true } = req.body || {};
  if (!title) return res.status(400).json({ ok:false, error:'title_required' });
  const item = { id: uid(), createdAt: new Date().toISOString(), title, summary, date, link, active: !!active };
  items.push(item); writeJson(NEWS_FILE, items);
  res.json({ ok: true, item });
});
// Admin: update
app.put('/api/admin/news/:id', checkAdmin, (req, res) => {
  const items = readJson(NEWS_FILE, []);
  const idx = items.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok:false, error:'not_found' });
  const prev = items[idx];
  const next = { ...prev, ...req.body, id: prev.id };
  items[idx] = next; writeJson(NEWS_FILE, items);
  res.json({ ok:true, item: next });
});
// Admin: delete
app.delete('/api/admin/news/:id', checkAdmin, (req, res) => {
  const items = readJson(NEWS_FILE, []);
  const next = items.filter(n => n.id !== req.params.id);
  if (next.length === items.length) return res.status(404).json({ ok:false, error:'not_found' });
  writeJson(NEWS_FILE, next); res.json({ ok:true });
});

// -------- Members APIs --------
const CATEGORIES = ['Ladies','Men','Mrs','Kids'];
// Public: list
app.get('/api/members', (req, res) => {
  const items = readJson(MEMBERS_FILE, []);
  let filtered = items.filter(m => m.active !== false);
  const cat = req.query.category; if (cat) filtered = filtered.filter(m => m.category === cat);
  filtered.sort((a,b)=> (a.order??0)-(b.order??0) || new Date(b.createdAt)-new Date(a.createdAt));
  res.json({ ok:true, items: filtered });
});
// Admin: list
app.get('/api/admin/members', checkAdmin, (_req, res) => {
  const items = readJson(MEMBERS_FILE, []);
  res.json({ ok:true, items });
});
// Admin: create
app.post('/api/admin/members', checkAdmin, (req, res) => {
  const items = readJson(MEMBERS_FILE, []);
  const { name, category, image = '', note = '', order = 0, active = true } = req.body || {};
  if (!name) return res.status(400).json({ ok:false, error:'name_required' });
  if (!category || !CATEGORIES.includes(category)) return res.status(400).json({ ok:false, error:'invalid_category' });
  const item = { id: uid(), createdAt: new Date().toISOString(), name, category, image, note, order:Number(order)||0, active: !!active };
  items.push(item); writeJson(MEMBERS_FILE, items);
  res.json({ ok:true, item });
});
// Admin: update
app.put('/api/admin/members/:id', checkAdmin, (req, res) => {
  const items = readJson(MEMBERS_FILE, []);
  const idx = items.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok:false, error:'not_found' });
  const prev = items[idx];
  const payload = req.body || {};
  if (payload.category && !CATEGORIES.includes(payload.category)) return res.status(400).json({ ok:false, error:'invalid_category' });
  const next = { ...prev, ...payload, id: prev.id };
  items[idx] = next; writeJson(MEMBERS_FILE, items);
  res.json({ ok:true, item: next });
});
// Admin: delete
app.delete('/api/admin/members/:id', checkAdmin, (req, res) => {
  const items = readJson(MEMBERS_FILE, []);
  const next = items.filter(m => m.id !== req.params.id);
  if (next.length === items.length) return res.status(404).json({ ok:false, error:'not_found' });
  writeJson(MEMBERS_FILE, next); res.json({ ok:true });
});

// Admin: upload a single file (image) and return saved path
app.post('/api/admin/upload', checkAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok:false, error:'file_required' });
  const file = req.file;
  const safeName = `${Date.now()}_${file.originalname}`.replace(/[^\w.\-]/g, '_');
  const abs = path.join(UPLOAD_DIR, safeName);
  fs.writeFileSync(abs, file.buffer);
  res.json({ ok:true, path: `/uploads/${safeName}`, filename: safeName, mimetype: file.mimetype, size: file.size });
});

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

// 静的サイトを提供（プロジェクト直下）
const PUBLIC_DIR = process.cwd();
app.use(express.static(PUBLIC_DIR));

// ルート/ショートカット
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/apply', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'apply.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// 静的ファイル配信（明示パス）
const ROOT = process.cwd();
app.use('/assets', express.static(path.join(ROOT, 'assets')));
app.use('/image',  express.static(path.join(ROOT, 'image')));

// 主要HTMLを明示ルーティング（Safariのキャッシュやルート解決の差異を避ける）
app.get(['/', '/index.html'], (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});
app.get('/apply.html', (_req, res) => {
  res.sendFile(path.join(ROOT, 'apply.html'));
});
app.get('/admin.html', (_req, res) => {
  res.sendFile(path.join(ROOT, 'admin.html'));
});

// 任意の .html を動的に配信（/foo.html -> ROOT/foo.html）
app.get(/^\/.+\.html$/, (req, res) => {
  const target = path.join(ROOT, decodeURIComponent(req.path.replace(/^\//, '')));
  if (fs.existsSync(target)) {
    return res.sendFile(target);
  }
  return res.status(404).send('Not Found');
});

// 最後の保険: その他のGETは index.html を返す（/api 等は既に上でマッチ）
app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.listen(PORT, () => console.log(`Form server on http://localhost:${PORT}`));
