// Set REACT_APP_BACKEND_URL (in .env or .env.local) to point the app at another backend.
// The trailing slash matters: urls are built as `config.backendURL + 'graphql'` and
// `config.backendURL + image.url`.
const config = {
	backendURL: process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000/',
}

export default config;
