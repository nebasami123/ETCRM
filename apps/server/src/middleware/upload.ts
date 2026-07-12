import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { env } from "../config/env.js";

const acceptedExtensions = new Set([".csv", ".xlsx", ".xls"]);
const uploadDirectory = fileURLToPath(new URL("../../uploads", import.meta.url));

export const leadUpload = multer({
  dest: uploadDirectory,
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1 },
  fileFilter(_req, file, callback) {
    const extension = extname(file.originalname).toLowerCase();
    if (extension && acceptedExtensions.has(extension)) callback(null, true);
    else callback(new Error("Only CSV, XLSX, and XLS files are accepted"));
  }
});
