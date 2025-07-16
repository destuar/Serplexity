/**
 * @file uploadService.ts
 * @description This file provides a service for handling file uploads, specifically for images to AWS S3.
 * It configures `multer` and `multer-s3` to manage the upload process, including file type validation, size limits,
 * and generating unique filenames. It also provides a utility function to construct the public URL of an uploaded file.
 * This is a crucial component for managing media assets within the application.
 *
 * @dependencies
 * - multer: Middleware for handling `multipart/form-data`.
 * - path: Node.js module for handling file paths.
 * - @aws-sdk/client-s3: AWS SDK client for interacting with S3.
 * - multer-s3: Multer storage engine for Amazon S3.
 *
 * @exports
 * - upload: Multer instance configured for S3 uploads.
 * - getFileUrl: Function to construct the public URL of an uploaded file.
 */
import multer from 'multer';
import path from 'path';
import { S3Client } from '@aws-sdk/client-s3';
const multerS3 = require('multer-s3');

const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.AWS_REGION!,
});

const storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET_NAME!,
  key: (req: any, file: Express.Multer.File, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `blog/${uniqueSuffix}${extension}`);
  },
  contentType: multerS3.AUTO_CONTENT_TYPE,
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter
});

export const getFileUrl = (filename: string): string => {
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
};