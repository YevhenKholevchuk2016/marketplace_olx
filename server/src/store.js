import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';

import newId from './ids.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const serverRoot = path.resolve(here, '..');
export const dataDir = path.join(serverRoot, 'data');
export const uploadsDir = path.join(serverRoot, 'uploads');

const dbFile = path.join(dataDir, 'db.json');
const tmpFile = `${dbFile}.tmp`;

export const COLLECTIONS = ['users', 'ads', 'comments', 'images'];

const emptyDb = () => ({
	meta: {
		// Persisted so tokens issued before a restart keep working.
		secret: randomBytes(32).toString('hex'),
		createdAt: String(Date.now())
	},
	users: [],
	ads: [],
	comments: [],
	images: []
});

const load = () => {
	fs.mkdirSync(dataDir, {recursive: true});
	fs.mkdirSync(uploadsDir, {recursive: true});

	if (!fs.existsSync(dbFile)) {
		const fresh = emptyDb();
		fs.writeFileSync(dbFile, JSON.stringify(fresh, null, '\t'));
		return fresh;
	}

	try {
		const parsed = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
		// Fill in anything a hand-edited or older file is missing.
		return {...emptyDb(), ...parsed, meta: {...emptyDb().meta, ...parsed.meta}};
	} catch (e) {
		console.error(`[store] ${dbFile} is not valid JSON, starting from an empty database.`);
		console.error(`[store] ${e.message}`);
		return emptyDb();
	}
}

export const db = load();

let saveTimer = null;

// Write to a temp file and rename, so a crash mid-write cannot leave a truncated db.json.
export const saveNow = () => {
	if (saveTimer) {
		clearTimeout(saveTimer);
		saveTimer = null;
	}

	fs.writeFileSync(tmpFile, JSON.stringify(db, null, '\t'));
	fs.renameSync(tmpFile, dbFile);
}

// Writes are batched: a burst of mutations costs a single disk write.
export const save = () => {
	if (saveTimer) return;

	saveTimer = setTimeout(() => {
		saveTimer = null;
		try {
			saveNow();
		} catch (e) {
			console.error(`[store] failed to persist the database: ${e.message}`);
		}
	}, 50);
}

export const coll = (name) => {
	if (!COLLECTIONS.includes(name)) throw new Error(`Unknown collection "${name}"`);

	return db[name];
}

export const findById = (name, id) =>
	id === null || id === undefined
		? null
		: coll(name).find(doc => doc._id === String(id)) || null;

export const findOne = (name, predicate) => coll(name).find(predicate) || null;

export const insert = (name, doc) => {
	const created = {_id: newId(), createdAt: String(Date.now()), ...doc};
	coll(name).push(created);
	save();

	return created;
}

export const update = (name, id, patch) => {
	const doc = findById(name, id);
	if (!doc) return null;

	// Undefined means "not supplied by the client", so it must not erase a stored value.
	for (const [key, value] of Object.entries(patch)) {
		if (value !== undefined) doc[key] = value;
	}
	save();

	return doc;
}

export const resetAll = () => {
	for (const name of COLLECTIONS) db[name] = [];
	saveNow();
}

// Flush pending writes when the process is asked to stop.
for (const signal of ['SIGINT', 'SIGTERM']) {
	process.on(signal, () => {
		try {
			saveNow();
		} catch (e) {
			console.error(`[store] failed to persist on ${signal}: ${e.message}`);
		}
		process.exit(0);
	});
}
