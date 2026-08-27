import express from 'express';
import cors from 'cors';
import {graphql} from 'graphql';

import buildExecutableSchema from './schema.js';
import resolvers from './resolvers.js';
import {bearerAuth} from './auth.js';
import uploadRoute from './upload.js';
import {coll, uploadsDir} from './store.js';
import {autoSeedIfEmpty} from './seed.js';

const PORT = Number(process.env.PORT) || 4000;

const schema = buildExecutableSchema(resolvers);

const app = express();

app.disable('x-powered-by');

// The original server died behind a proxy that answered every preflight with a 308 to
// https, and a redirect on a preflight is what the browser refuses. So: no redirects
// anywhere in this app, and OPTIONS is answered directly with 204.
app.use(cors({
	origin: true,
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
	maxAge: 600
}));

app.use(bearerAuth);

/* --------------------------------------------------------------------- graphql */

// Read the body as text no matter which content type arrived. This matters because
// src/components/utils/anonGql sends no Content-Type header at all, so the browser
// labels the body `text/plain` even though it is JSON.
const readBody = express.text({type: () => true, limit: '2mb'});

app.post('/graphql', readBody, async (req, res) => {
	let body;

	try {
		body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
	} catch (e) {
		res.status(400).json({errors: [{message: `Request body is not valid JSON: ${e.message}`}]});
		return;
	}

	const {query, variables, operationName} = body;

	if (!query) {
		res.status(400).json({errors: [{message: 'No "query" field in the request body'}]});
		return;
	}

	try {
		const result = await graphql({
			schema,
			source: query,
			contextValue: {user: req.user},
			variableValues: variables || {},
			operationName
		});

		if (result.errors?.length) {
			console.warn(`[graphql] ${operationName || 'anonymous'}: ${result.errors.map(e => e.message).join('; ')}`);
		}

		// Always 200: execution errors travel in the `errors` array, which is what the
		// frontend's gql helper inspects.
		res.json(result);
	} catch (e) {
		console.error(`[graphql] unexpected failure: ${e.stack || e.message}`);
		res.status(500).json({errors: [{message: e.message}]});
	}
});

app.get('/graphql', (req, res) => {
	res.type('text/plain').send(
		'This is the GraphQL endpoint. Send queries as POST {"query": "...", "variables": {...}}.'
	);
});

/* ------------------------------------------------------------ uploads & status */

app.post('/upload', uploadRoute);

app.use('/uploads', express.static(uploadsDir));

app.get('/', (req, res) => {
	res.json({
		name: 'marketplace_olx backend',
		endpoints: {graphql: 'POST /graphql', upload: 'POST /upload', files: 'GET /uploads/<name>'},
		counts: {
			users: coll('users').length,
			ads: coll('ads').length,
			comments: coll('comments').length,
			images: coll('images').length
		}
	});
});

app.use((req, res) => {
	res.status(404).json({error: `No route for ${req.method} ${req.originalUrl}`});
});

app.listen(PORT, () => {
	console.log(`marketplace_olx backend listening on http://localhost:${PORT}`);
	console.log(`  graphql  POST http://localhost:${PORT}/graphql`);
	console.log(`  upload   POST http://localhost:${PORT}/upload`);

	// Auto-seed demo data if the database is empty (e.g. after a Render free-tier restart).
	autoSeedIfEmpty();

	console.log(`  ads in database: ${coll('ads').length}`);
});
