const promiseReducer = (state={}, {type, name, status, payload, error}) =>{
	if (type === 'PROMISE'){
		return {
			...state,
			[name]:{
				status,
				payload: (status === 'PENDING' && state[name]?.payload) ? state[name]?.payload : payload,
				error,
			},
		}
	}
	if (type === 'PROMISE_CLEAR') {
		const newState = { ...state };
		delete newState[name];
		return newState;
	}
	return state
}

export default promiseReducer;