import {buildSchema} from 'graphql';

// Mirrors what src/actions/** already asks for. A few notes on the exact types, because
// the frontend's existing queries will not validate otherwise:
//
//  * UserInput._id is String, not ID: src/actions/avatar declares `$userID: String` and
//    uses it where `_id` is expected, and graphql-js refuses a String variable in an ID
//    position. The other inputs are reached through `ID` variables, so they stay ID.
//  * every `createdAt` is a String holding epoch milliseconds, because
//    src/components/comments does `new Date(+comment.createdAt)`.
export const typeDefs = /* GraphQL */ `
	type Image {
		_id: ID
		url: String
		originalFileName: String
		size: Int
		owner: User
		createdAt: String
	}

	type User {
		_id: ID
		login: String
		nick: String
		phones: [String]
		addresses: [String]
		avatar: Image
		createdAt: String
	}

	type Ad {
		_id: ID
		title: String
		description: String
		price: Float
		address: String
		tags: [String]
		owner: User
		images: [Image]
		comments: [Comment]
		createdAt: String
	}

	type Comment {
		_id: ID
		text: String
		owner: User
		ad: Ad
		answerTo: Comment
		answers: [Comment]
		createdAt: String
	}

	input ImageInput {
		_id: ID
	}

	input UserInput {
		_id: String
		login: String
		nick: String
		phones: [String]
		addresses: [String]
		avatar: ImageInput
	}

	input AdInput {
		_id: ID
		title: String
		description: String
		price: Float
		address: String
		tags: [String]
		images: [ImageInput]
	}

	input CommentInput {
		_id: ID
		text: String
		ad: AdInput
		answerTo: CommentInput
	}

	type Query {
		login(login: String!, password: String!): String

		UserFind(query: String): [User]
		UserFindOne(query: String): User
		UserCount(query: String): Int

		AdFind(query: String): [Ad]
		AdFindOne(query: String): Ad
		AdCount(query: String): Int

		CommentFind(query: String): [Comment]
		CommentFindOne(query: String): Comment
		CommentCount(query: String): Int
	}

	type Mutation {
		createUser(login: String!, password: String!): User
		changePassword(login: String!, password: String!, newPassword: String!): User

		UserUpsert(user: UserInput): User
		AdUpsert(ad: AdInput): Ad
		AdDelete(ad: AdInput): Ad
		CommentUpsert(comment: CommentInput): Comment
	}
`;

// buildSchema gives us types without resolvers, so attach them by walking the type map.
// This keeps the dependency list to just `graphql` - no @graphql-tools/schema needed -
// while still allowing per-type field resolvers, which the relation fields require.
export const addResolvers = (schema, resolvers) => {
	for (const [typeName, fields] of Object.entries(resolvers)) {
		const type = schema.getType(typeName);
		if (!type || typeof type.getFields !== 'function') {
			throw new Error(`Cannot attach resolvers: type "${typeName}" is not in the schema`);
		}

		const schemaFields = type.getFields();
		for (const [fieldName, resolve] of Object.entries(fields)) {
			if (!schemaFields[fieldName]) {
				throw new Error(`Cannot attach resolvers: "${typeName}.${fieldName}" is not in the schema`);
			}
			schemaFields[fieldName].resolve = resolve;
		}
	}

	return schema;
}

const buildExecutableSchema = (resolvers) => addResolvers(buildSchema(typeDefs), resolvers);

export default buildExecutableSchema;
