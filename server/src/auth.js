import {createHmac, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';

import {db} from './store.js';

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

const secret = () => process.env.JWT_SECRET || db.meta.secret;

/* ------------------------------------------------------------------ passwords */

export const hashPassword = (password) => {
	const salt = randomBytes(16);
	const key = scryptSync(String(password), salt, 64);

	return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`;
}

export const verifyPassword = (password, stored) => {
	if (typeof stored !== 'string') return false;

	const [scheme, saltHex, keyHex] = stored.split(':');
	if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;

	const expected = Buffer.from(keyHex, 'hex');
	const actual = scryptSync(String(password), Buffer.from(saltHex, 'hex'), expected.length);

	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* ---------------------------------------------------------------------- JWT */

const base64url = (input) =>
	Buffer.from(input).toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');

const fromBase64url = (input) =>
	Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

const sign = (data) => base64url(createHmac('sha256', secret()).update(data).digest());

// The frontend reads `state.auth.payload.sub.id` (src/reducers/auth), so the payload
// shape below is not free to change.
export const signToken = (user) => {
	const issuedAt = Math.floor(Date.now() / 1000);
	const header = {alg: 'HS256', typ: 'JWT'};
	const payload = {
		sub: {
			id: user._id,
			login: user.login,
			nick: user.nick || null,
			acl: ['user', user._id]
		},
		iat: issuedAt,
		exp: issuedAt + TOKEN_TTL_SECONDS
	};

	const body = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

	return `${body}.${sign(body)}`;
}

export const verifyToken = (token) => {
	if (typeof token !== 'string') return null;

	const parts = token.split('.');
	if (parts.length !== 3) return null;

	const [header, payload, signature] = parts;
	const expected = sign(`${header}.${payload}`);

	// Both are base64url of a 32-byte digest, so lengths always match here.
	if (signature.length !== expected.length) return null;
	if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

	try {
		const decoded = JSON.parse(fromBase64url(payload));
		if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;

		return decoded;
	} catch (e) {
		return null;
	}
}

/* -------------------------------------------------------------- middleware */

// Never rejects: an absent or invalid token simply leaves the request anonymous, and
// individual resolvers decide whether that is allowed.
export const bearerAuth = (req, res, next) => {
	const header = req.headers.authorization || '';
	const [scheme, token] = header.split(' ');

	if (scheme === 'Bearer' && token) {
		const payload = verifyToken(token);
		if (payload) {
			req.user = payload.sub;
			req.tokenPayload = payload;
		}
	}

	next();
}
