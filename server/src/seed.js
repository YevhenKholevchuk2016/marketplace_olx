import fs from 'node:fs';
import path from 'node:path';

import {coll, insert, resetAll, saveNow, uploadsDir} from './store.js';
import {hashPassword} from './auth.js';
import newId from './ids.js';

/* ---------------------------------------------------------- placeholder images */

const PALETTE = [
	['#1e3a5f', '#4f9cf9'], ['#3f2a56', '#b07de8'], ['#0f4c3a', '#3ddc97'],
	['#5c2b29', '#ff8a65'], ['#4a3f11', '#ffd166'], ['#123c5c', '#4dd0e1']
];

const escapeXml = (text) => String(text)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

// Generated locally rather than downloaded, so seeding works with no network access.
const placeholderSvg = (label, index) => {
	const [background, accent] = PALETTE[index % PALETTE.length];

	return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
	<rect width="800" height="600" fill="${background}"/>
	<circle cx="640" cy="140" r="120" fill="${accent}" opacity="0.25"/>
	<circle cx="150" cy="500" r="160" fill="${accent}" opacity="0.18"/>
	<text x="400" y="300" fill="${accent}" font-family="Segoe UI, Arial, sans-serif" font-size="44"
	      font-weight="600" text-anchor="middle">${escapeXml(label)}</text>
	<text x="400" y="352" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="22"
	      text-anchor="middle" opacity="0.6">demo image</text>
</svg>
`;
}

const makeImage = (label, index, ownerId) => {
	const filename = `${newId()}.svg`;
	fs.writeFileSync(path.join(uploadsDir, filename), placeholderSvg(label, index));

	return insert('images', {
		url: `uploads/${filename}`,
		originalFileName: `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`,
		size: null,
		mimetype: 'image/svg+xml',
		___owner: ownerId,
		___seed: true
	});
}

/* ------------------------------------------------------------------- demo data */

const USERS = [
	{login: 'demo1', nick: 'Olena'},
	{login: 'demo2', nick: 'Taras'},
	{login: 'demo3', nick: 'Marta'}
];

const PASSWORD = '123456';

// 12 ads so the feed's 5-per-page pagination needs three pages.
const ADS = [
	{owner: 0, title: 'MacBook Air M2 13"', price: 38500, description: 'Bought last spring, 41 charge cycles. Comes with the original box and charger. Space grey.', images: 2},
	{owner: 0, title: 'Herman Miller Aeron chair', price: 21000, description: 'Size B, fully adjustable armrests. Mesh is intact, no tears. Pickup only.', images: 1},
	{owner: 0, title: 'Canon EOS 250D + 18-55mm', price: 15400, description: 'Entry level DSLR in very good condition. Includes two batteries and a 64GB card.', images: 3},
	{owner: 0, title: 'Road bike Giant Contend 3', price: 17900, description: 'Size M, aluminium frame, Shimano Claris. Serviced in June, new chain and tyres.', images: 1},
	{owner: 1, title: 'iPhone 13 128GB', price: 19500, description: 'Battery health 89%. Screen has no scratches, always kept in a case. Unlocked.', images: 2},
	{owner: 1, title: 'Sony WH-1000XM4 headphones', price: 7200, description: 'Noise cancelling over-ears with the carrying case. Ear pads recently replaced.', images: 1},
	{owner: 1, title: 'IKEA Kallax shelf 4x4', price: 2400, description: 'White, disassembled and ready to transport. All screws and dowels included.', images: 1},
	{owner: 1, title: 'Espresso machine Gaggia Classic', price: 11000, description: 'Descaled regularly, comes with a bottomless basket and a tamper.', images: 2},
	{owner: 2, title: 'Nintendo Switch OLED', price: 12800, description: 'Includes a dock, two Joy-Con pairs and Mario Kart 8 Deluxe. Joy-Cons have no drift.', images: 2},
	{owner: 2, title: 'Winter tyres 205/55 R16', price: 6800, description: 'Set of four, one season used, about 7mm tread left. Nokian Hakkapeliitta.', images: 1},
	{owner: 2, title: 'Yamaha P-45 digital piano', price: 14200, description: '88 weighted keys, sustain pedal and stand included. Great for beginners.', images: 1},
	{owner: 2, title: 'Dyson V8 Animal vacuum', price: 8900, description: 'Cordless, holds about 30 minutes of charge. All original attachments present.', images: 2}
];

const COMMENTS = [
	{ad: 0, owner: 1, text: 'Is the warranty still valid?'},
	{ad: 0, owner: 0, text: 'Yes, it runs until next March. I can send a photo of the receipt.', answerTo: 0},
	{ad: 0, owner: 1, text: 'Perfect, I will take it. Sending you a message now.', answerTo: 1},
	{ad: 4, owner: 2, text: 'Would you consider 18000?'},
	{ad: 4, owner: 1, text: 'A bit low, but 18800 works for me.', answerTo: 3},
	{ad: 8, owner: 0, text: 'Which region is the console from?'}
];

/* ------------------------------------------------------------------------ run */

const clearSeedFiles = () => {
	for (const image of coll('images').filter(item => item.___seed && item.url)) {
		const file = path.join(uploadsDir, path.basename(image.url));
		try {
			fs.rmSync(file, {force: true});
		} catch (e) {
			console.warn(`[seed] could not remove ${file}: ${e.message}`);
		}
	}
}

const seed = () => {
	// Files uploaded by hand are left alone; only previously seeded placeholders go.
	clearSeedFiles();
	resetAll();

	const users = USERS.map(user => insert('users', {
		login: user.login,
		nick: user.nick,
		phones: [],
		addresses: [],
		avatar: null,
		___password: hashPassword(PASSWORD)
	}));

	users.forEach((user, index) => {
		const avatar = makeImage(user.nick, index + 3, user._id);
		user.avatar = avatar._id;
	});

	const ads = ADS.map((spec, index) => {
		const owner = users[spec.owner];
		const images = Array.from({length: spec.images}, (_, n) =>
			makeImage(`${spec.title} ${n + 1}/${spec.images}`, index + n, owner._id)._id);

		return insert('ads', {
			title: spec.title,
			description: spec.description,
			price: spec.price,
			address: null,
			tags: [],
			images,
			___owner: owner._id
		});
	});

	const comments = [];
	for (const spec of COMMENTS) {
		comments.push(insert('comments', {
			text: spec.text,
			___owner: users[spec.owner]._id,
			___ad: ads[spec.ad]._id,
			___answerTo: spec.answerTo === undefined ? null : comments[spec.answerTo]._id
		}));
	}

	saveNow();

	console.log('Seeded the database:');
	console.log(`  users     ${users.length}  (logins ${USERS.map(u => u.login).join(', ')} - password "${PASSWORD}")`);
	console.log(`  ads       ${ads.length}`);
	console.log(`  comments  ${comments.length}`);
	console.log(`  images    ${coll('images').length}`);
}

/* --------------------------------------------------------- exported helpers */

// Seed only when the database is completely empty (called by the server on startup).
export const autoSeedIfEmpty = () => {
	if (coll('users').length === 0 && coll('ads').length === 0) {
		console.log('[seed] database is empty — seeding demo data…');
		seed();
	}
}

// When run directly as a script (npm run seed) always re-seed everything.
// process.argv[1] ends with 'seed.js' in that case.
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
	seed();
}
