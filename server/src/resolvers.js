import {GraphQLError} from 'graphql';

import {coll, findById, insert, save, update} from './store.js';
import {runCount, runFind, parseQuery} from './query.js';
import {hashPassword, signToken, verifyPassword} from './auth.js';

// Stored documents keep their relations in `___`-prefixed fields, the same convention the
// original backend used - which is why the frontend can query `AdFind` with
// `{___owner: userId}` (see src/actions/userAds) and have it work.
//
//   users:    {_id, login, nick, phones, addresses, avatar: imageId, ___password}
//   ads:      {_id, title, description, price, images: [imageId], ___owner}
//   comments: {_id, text, ___owner, ___ad, ___answerTo}
//   images:   {_id, url, originalFileName, size, ___owner}

const fail = (message, code = 'BAD_REQUEST') => {
	throw new GraphQLError(message, {extensions: {code}});
}

const requireUser = (context) => {
	if (!context.user?.id) fail('Authorization required', 'UNAUTHENTICATED');

	return context.user;
}

const trimmed = (value) => typeof value === 'string' ? value.trim() : value;

// The form in src/components/profile/about starts blank and is never prefilled, so it
// submits empty strings for fields the user did not touch. Treating those as "no change"
// keeps a profile save from wiping the login and locking the account out.
const orSkip = (value) => {
	const text = trimmed(value);

	return text === '' || text === null || text === undefined ? undefined : text;
}

const findUserByLogin = (login) => {
	const wanted = String(trimmed(login) ?? '').toLowerCase();
	if (!wanted) return null;

	// Case-insensitive, so "Demo1" and "demo1" cannot become two accounts.
	return coll('users').find(user => String(user.login).toLowerCase() === wanted) || null;
}

// A FindOne with an empty filter would otherwise hand back an arbitrary document. That
// happens for real: src/actions/aboutMe passes `undefined` as the id when nobody is
// logged in, and JSON.stringify drops the key.
const findOneBy = (collection, query) => {
	const [filter] = parseQuery(query);
	if (!Object.keys(filter).length) return null;

	return runFind(coll(collection), query)[0] || null;
}

const imageIdsFrom = (images) => {
	if (!Array.isArray(images)) return undefined;

	// Order is preserved on purpose: src/components/adEdit lets the user reorder photos
	// by drag-and-drop and saves the new order.
	return images
		.map(image => image?._id)
		.filter(id => id && findById('images', id))
		.map(String);
}

/* ------------------------------------------------------------------- queries */

const Query = {
	login: (_parent, {login, password}) => {
		const user = findUserByLogin(login);

		// Returning null rather than an error matches what the frontend expects:
		// src/actions/auth/fullLogin only dispatches when a token comes back.
		if (!user || !verifyPassword(password, user.___password)) return null;

		return signToken(user);
	},

	UserFind:    (_parent, {query}) => runFind(coll('users'), query),
	UserFindOne: (_parent, {query}) => findOneBy('users', query),
	UserCount:   (_parent, {query}) => runCount(coll('users'), query),

	AdFind:    (_parent, {query}) => runFind(coll('ads'), query),
	AdFindOne: (_parent, {query}) => findOneBy('ads', query),
	AdCount:   (_parent, {query}) => runCount(coll('ads'), query),

	CommentFind:    (_parent, {query}) => runFind(coll('comments'), query),
	CommentFindOne: (_parent, {query}) => findOneBy('comments', query),
	CommentCount:   (_parent, {query}) => runCount(coll('comments'), query)
};

/* ----------------------------------------------------------------- mutations */

const Mutation = {
	createUser: (_parent, {login, password}) => {
		const cleanLogin = trimmed(login);

		if (!cleanLogin) fail('Login cannot be empty');
		if (!password) fail('Password cannot be empty');
		if (findUserByLogin(cleanLogin)) fail(`Login "${cleanLogin}" is already taken`, 'CONFLICT');

		return insert('users', {
			login: cleanLogin,
			nick: null,
			phones: [],
			addresses: [],
			avatar: null,
			___password: hashPassword(password)
		});
	},

	changePassword: (_parent, {login, password, newPassword}) => {
		const user = findUserByLogin(login);

		// Reached without a token (src/actions/updatePassword uses anonGql), so knowing
		// the current password is the only thing authorising this.
		if (!user || !verifyPassword(password, user.___password)) fail('Wrong login or password', 'FORBIDDEN');
		if (!newPassword) fail('New password cannot be empty');

		return update('users', user._id, {___password: hashPassword(newPassword)});
	},

	UserUpsert: (_parent, {user}, context) => {
		const me = requireUser(context);
		if (!user) fail('Nothing to update');
		if (user._id && String(user._id) !== String(me.id)) fail('You can only edit your own profile', 'FORBIDDEN');

		const target = findById('users', me.id);
		if (!target) fail('User not found', 'NOT_FOUND');

		const login = orSkip(user.login);
		if (login) {
			const clash = findUserByLogin(login);
			if (clash && clash._id !== target._id) fail(`Login "${login}" is already taken`, 'CONFLICT');
		}

		let avatar;
		if (user.avatar) {
			const image = findById('images', user.avatar._id);
			if (!image) fail('Avatar image not found', 'NOT_FOUND');
			avatar = image._id;
		}

		return update('users', target._id, {
			login,
			nick: orSkip(user.nick),
			phones: user.phones,
			addresses: user.addresses,
			avatar
		});
	},

	AdUpsert: (_parent, {ad}, context) => {
		const me = requireUser(context);
		if (!ad) fail('Nothing to save');

		const patch = {
			title: trimmed(ad.title),
			description: trimmed(ad.description),
			price: ad.price === undefined || ad.price === null ? undefined : Number(ad.price),
			address: trimmed(ad.address),
			tags: ad.tags,
			images: imageIdsFrom(ad.images)
		};

		if (ad._id) {
			const existing = findById('ads', ad._id);
			if (!existing) fail('Ad not found', 'NOT_FOUND');
			if (String(existing.___owner) !== String(me.id)) fail('You can only edit your own ads', 'FORBIDDEN');

			return update('ads', existing._id, patch);
		}

		if (!patch.title) fail('An ad needs a title');

		return insert('ads', {
			title: patch.title,
			description: patch.description ?? '',
			price: patch.price ?? 0,
			address: patch.address ?? null,
			tags: patch.tags ?? [],
			images: patch.images ?? [],
			___owner: String(me.id)
		});
	},

	AdDelete: (_parent, {ad}, context) => {
		const me = requireUser(context);

		const existing = findById('ads', ad?._id);
		if (!existing) fail('Ad not found', 'NOT_FOUND');
		if (String(existing.___owner) !== String(me.id)) fail('You can only delete your own ads', 'FORBIDDEN');

		const ads = coll('ads');
		ads.splice(ads.indexOf(existing), 1);

		const comments = coll('comments');
		for (const comment of comments.filter(item => item.___ad === existing._id)) {
			comments.splice(comments.indexOf(comment), 1);
		}
		save();

		return existing;
	},

	CommentUpsert: (_parent, {comment}, context) => {
		const me = requireUser(context);

		const text = trimmed(comment?.text);
		if (!text) fail('A comment cannot be empty');

		if (comment._id) {
			const existing = findById('comments', comment._id);
			if (!existing) fail('Comment not found', 'NOT_FOUND');
			if (String(existing.___owner) !== String(me.id)) fail('You can only edit your own comments', 'FORBIDDEN');

			return update('comments', existing._id, {text});
		}

		const ad = findById('ads', comment.ad?._id);
		if (!ad) fail('Ad not found', 'NOT_FOUND');

		// src/actions/comment always sends `answerTo`, with a null _id for a top-level
		// comment, so an absent id has to mean "not a reply" rather than an error.
		let answerTo = null;
		if (comment.answerTo?._id) {
			const parent = findById('comments', comment.answerTo._id);
			if (!parent) fail('The comment being answered no longer exists', 'NOT_FOUND');
			answerTo = parent._id;
		}

		return insert('comments', {
			text,
			___owner: String(me.id),
			___ad: ad._id,
			___answerTo: answerTo
		});
	}
};

/* ------------------------------------------------------------ relation fields */

const byIdAscending = (a, b) => a._id < b._id ? -1 : a._id > b._id ? 1 : 0;

const resolvers = {
	Query,
	Mutation,

	User: {
		// `___password` is never exposed: it has no field in the schema.
		avatar: (user) => findById('images', user.avatar)
	},

	Image: {
		owner: (image) => findById('users', image.___owner)
	},

	Ad: {
		owner: (ad) => findById('users', ad.___owner),
		images: (ad) => (ad.images || []).map(id => findById('images', id)).filter(Boolean),
		comments: (ad) => coll('comments').filter(comment => comment.___ad === ad._id).sort(byIdAscending)
	},

	Comment: {
		owner: (comment) => findById('users', comment.___owner),
		ad: (comment) => findById('ads', comment.___ad),
		answerTo: (comment) => findById('comments', comment.___answerTo),
		answers: (comment) => coll('comments').filter(item => item.___answerTo === comment._id).sort(byIdAscending)
	}
};

export default resolvers;
