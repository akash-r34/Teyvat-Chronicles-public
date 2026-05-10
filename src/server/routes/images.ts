import express from "express";
import { db } from '../db.ts';

export const imagesRouter = express.Router();

imagesRouter.get("/:id", (req, res) => {
    const { id } = req.params;
    const img = db.prepare('SELECT mime, bytes FROM images WHERE id = ?').get(id) as any;
    if (!img) return res.status(404).send('Not found');
    res.set('Content-Type', img.mime);
    res.send(img.bytes);
});
