import path from 'node:path';

import multer from 'multer';

import {insert, uploadsDir} from './store.js';
import newId from './ids.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const storage = multer.diskStorage({
	destination: (req, file, done) => done(null, uploadsDir),
	filename: (req, file, done) => {
		const extension = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
		done(null, `${newId()}${extension}`);
	}
});

const upload = multer({
	storage,
	limits: {fileSize: MAX_FILE_SIZE, files: 1},
	fileFilter: (req, file, done) => {
		if (!String(file.mimetype).startsWith('image/')) {
			done(new Error('Only image files can be uploaded'));
			return;
		}
		done(null, true);
	}
});

// src/actions/upload posts FormData with a single `photo` field and reads `_id` and `url`
// off the JSON response.
const uploadRoute = (req, res) => {
	if (!req.user?.id) {
		res.status(401).json({error: 'Authorization required to upload files'});
		return;
	}

	upload.single('photo')(req, res, (error) => {
		if (error) {
			res.status(400).json({error: error.message});
			return;
		}

		if (!req.file) {
			res.status(400).json({error: 'No file was uploaded under the "photo" field'});
			return;
		}

		// The url is relative and has no leading slash, because every call site does
		// `config.backendURL + image.url` and backendURL already ends with a slash.
		const image = insert('images', {
			url: `uploads/${req.file.filename}`,
			originalFileName: req.file.originalname,
			size: req.file.size,
			mimetype: req.file.mimetype,
			___owner: String(req.user.id)
		});

		res.json(image);
	});
}

export default uploadRoute;
