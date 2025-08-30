Everne Forms

Setup

- Copy `.env.example` to `.env` and fill the values:
  - `SMTP_*`, `MAIL_FROM`, `MAIL_TO`: for email notifications
  - `ADMIN_TOKEN`: any random string to protect admin APIs
  - `PORT` and `FRONT_ORIGIN` as needed
- Install deps and run the API server:
  - `npm install`
  - `npm start` (starts on `http://127.0.0.1:5174` by default)

Frontend

- Forms: open `apply.html` in your browser and submit. The client posts to `http://127.0.0.1:5174/api/apply`.
- Admin: open `admin.html` to view submissions. On first use it asks for `ADMIN_TOKEN` if set on the server. Downloads are available as CSV.

Storage

- Uploaded images: `uploads/`
- JSON lines (one record per line): `data/applications.jsonl`
- CSV log: `logs/apply.csv`

Security Notes

- Set `ADMIN_TOKEN` in production and share only with authorized staff. The client sends it via `x-admin-token` header.
- Consider serving the static site via HTTPS and moving uploads to external storage (e.g., S3) for scale and backup.

