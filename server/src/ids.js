import {randomBytes} from 'node:crypto';

// The frontend feed pages through ads with `sort: [{_id: -1}], limit: [5], skip: [n]`
// (see src/actions/adList), so ids have to sort chronologically as plain strings the
// way Mongo's ObjectId does. Layout, 24 hex chars total:
//
//   [8: seconds since epoch][6: monotonic counter][10: per-process random]
//
// The timestamp orders ids across seconds, the counter orders ids created inside the
// same second, and the random tail keeps two processes started in the same second from
// colliding.
const RANDOM_TAIL = randomBytes(5).toString('hex');

let counter = 0;

const newId = () => {
	const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
	const seq = (counter++ % 0xffffff).toString(16).padStart(6, '0');

	return `${seconds}${seq}${RANDOM_TAIL}`;
}

export default newId;
