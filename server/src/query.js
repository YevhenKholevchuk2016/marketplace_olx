// A deliberately small interpreter for the Mongo-style query strings the frontend
// already sends. Every query arrives as a JSON string holding `[filter, options]`:
//
//   [{$or: [{title: '/laptop/'}, {description: '/laptop/'}]},
//    {sort: [{_id: -1}], limit: [5], skip: [10]}]
//
// Note that option values are wrapped in arrays - that is the A-Level convention the
// existing actions in src/actions/** use, so it is kept as-is.

const REGEX_LITERAL = /^\/(.*)\/([gimsuy]*)$/;

export const parseQuery = (queryString) => {
	if (!queryString) return [{}, {}];

	try {
		const parsed = JSON.parse(queryString);
		if (Array.isArray(parsed)) {
			return [parsed[0] || {}, parsed[1] || {}];
		}
		// Tolerate a bare filter object instead of the [filter, options] pair.
		return [parsed || {}, {}];
	} catch (e) {
		return [{}, {}];
	}
}

// `'/laptop/'` -> /laptop/i. Searching with an empty box produces `'//'`, which becomes
// an empty regex and therefore matches every document.
const toRegExp = (value) => {
	if (typeof value !== 'string') return null;

	const match = REGEX_LITERAL.exec(value);
	if (!match) return null;

	try {
		// Default to a case-insensitive search - the frontend never passes flags.
		return new RegExp(match[1], match[2] || 'i');
	} catch (e) {
		return null;
	}
}

const isPlainObject = (value) =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const looseEqual = (actual, expected) => {
	if (expected === null) return actual === null || actual === undefined;
	if (actual === null || actual === undefined) return false;

	// Ids arrive as strings, prices as numbers - compare on the string form so both work.
	return typeof actual === 'object'
		? JSON.stringify(actual) === JSON.stringify(expected)
		: String(actual) === String(expected);
}

const matchScalar = (actual, condition) => {
	const regex = toRegExp(condition);
	if (regex) return regex.test(actual === null || actual === undefined ? '' : String(actual));

	if (isPlainObject(condition)) {
		return Object.entries(condition).every(([operator, operand]) => {
			switch (operator) {
				case '$eq':     return looseEqual(actual, operand);
				case '$ne':     return !looseEqual(actual, operand);
				case '$in':     return (operand || []).some(item => looseEqual(actual, item));
				case '$nin':    return !(operand || []).some(item => looseEqual(actual, item));
				case '$gt':     return actual > operand;
				case '$gte':    return actual >= operand;
				case '$lt':     return actual < operand;
				case '$lte':    return actual <= operand;
				case '$exists': return (actual !== undefined && actual !== null) === !!operand;
				case '$regex':  return new RegExp(operand, condition.$options || 'i').test(String(actual ?? ''));
				case '$options':return true; // consumed by $regex
				default:        return looseEqual(actual, condition);
			}
		});
	}

	return looseEqual(actual, condition);
}

const matchField = (actual, condition) => {
	// Mongo matches an array field when any element matches, which is what makes
	// filtering on `phones` / `addresses` / `tags` behave as expected.
	if (Array.isArray(actual) && !Array.isArray(condition)) {
		return actual.some(item => matchScalar(item, condition)) || matchScalar(actual, condition);
	}

	return matchScalar(actual, condition);
}

export const matches = (doc, filter) => {
	if (!isPlainObject(filter)) return true;

	return Object.entries(filter).every(([key, condition]) => {
		if (key === '$or')  return (condition || []).some(sub => matches(doc, sub));
		if (key === '$and') return (condition || []).every(sub => matches(doc, sub));
		if (key === '$nor') return !(condition || []).some(sub => matches(doc, sub));

		return matchField(doc[key], condition);
	});
}

// Option values are wrapped in single-element arrays by the frontend.
const unwrap = (value) => Array.isArray(value) ? value[0] : value;

const compare = (a, b) => {
	if (a === b) return 0;
	if (a === null || a === undefined) return -1;
	if (b === null || b === undefined) return 1;
	if (typeof a === 'number' && typeof b === 'number') return a - b;

	return String(a) < String(b) ? -1 : 1;
}

const applySort = (items, sort) => {
	if (!sort) return items;

	// `sort` is a list of single-key objects: [{price: 1}, {_id: -1}].
	const keys = (Array.isArray(sort) ? sort : [sort])
		.filter(isPlainObject)
		.flatMap(entry => Object.entries(entry));

	if (!keys.length) return items;

	return [...items].sort((left, right) => {
		for (const [field, direction] of keys) {
			const result = compare(left[field], right[field]);
			if (result !== 0) return direction < 0 ? -result : result;
		}
		return 0;
	});
}

export const applyOptions = (items, options = {}) => {
	let result = applySort(items, options.sort);

	const skip = Number(unwrap(options.skip)) || 0;
	if (skip > 0) result = result.slice(skip);

	const limit = Number(unwrap(options.limit));
	if (limit > 0) result = result.slice(0, limit);

	return result;
}

// Filter + sort + paginate. Used by AdFind / UserFind / CommentFind.
export const runFind = (items, queryString) => {
	const [filter, options] = parseQuery(queryString);

	return applyOptions(items.filter(doc => matches(doc, filter)), options);
}

// Count ignores `limit` / `skip` on purpose: the frontend uses AdCount to learn the
// total number of matches so it knows whether more pages exist.
export const runCount = (items, queryString) => {
	const [filter] = parseQuery(queryString);

	return items.filter(doc => matches(doc, filter)).length;
}
