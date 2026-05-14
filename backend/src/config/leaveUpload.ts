import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(__dirname, '../../uploads/leaves');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `leave-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /jpeg|jpg|png|webp|pdf|doc|docx/;
  const valid = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
  valid ? cb(null, true) : cb(new Error('Only images, PDF, and DOC files are allowed!'));
};

export const leaveUpload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });
