require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_MB = 5;

app.post('/api/upload-url', async (req, res) => {
  try {
    const { filename, contentType, sizeBytes } = req.body;
    if (!filename || !ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: 'Tipo de archivo no permitido' });
    }
    if (typeof sizeBytes !== 'number' || sizeBytes <= 0) {
      return res.status(400).json({ error: 'Tamano invalido' });
    }
    if (sizeBytes > MAX_SIZE_MB * 1024 * 1024) {
      return res.status(400).json({ error: 'Archivo demasiado grande' });
    }
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `originales/${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeName}`;
    const cmd = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    res.json({ uploadUrl: url, key });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.get('/api/images', async (req, res) => {
  try {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'originales/' }));
    const objs = (list.Contents || []).filter(o => o.Key !== 'originales/' && o.Size > 0);
    const items = await Promise.all(objs.map(async obj => {
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }), { expiresIn: 900 });
      return { key: obj.Key, size: obj.Size, lastModified: obj.LastModified, url };
    }));
    res.json(items);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.delete('/api/images/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    if (!key.startsWith('originales/')) {
      return res.status(400).json({ error: 'Clave invalida' });
    }
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.json({ deleted: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.listen(process.env.PORT, () => console.log(`API escuchando en :${process.env.PORT}`));
