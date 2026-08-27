const jwtDecode = (token) =>{
	try {
		// The payload is base64url, which atob rejects because of its '-' and '_'
		// characters, so translate it to plain base64 first. Decoding through
		// TextDecoder keeps non-ASCII logins intact.
		const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
		const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0))
		return JSON.parse(new TextDecoder().decode(bytes))
	}
	catch(e){
	}
}

const authReducer = (state={}, {type, token}) =>{
	if (type === 'AUTH_LOGIN'){
		const payload = jwtDecode(token)
		if (payload){
			return {
				token,
				payload
			}
		}
	}
	if (type === 'AUTH_LOGOUT'){
		return {}
	}
	return state
}

export default authReducer;