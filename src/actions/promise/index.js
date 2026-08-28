const actionPending = (name) => ({type: 'PROMISE', status: 'PENDING', name})
const actionFulfilled = (name, payload) => ({type: 'PROMISE', status: 'FULFILLED', name, payload});
const actionRejected = (name, error) => ({type: 'PROMISE', status: 'REJECTED', name, error});

const actionPromise = (name, promise) =>
	async dispatch => {
		try {
			dispatch(actionPending(name))
			let payload = await promise
			dispatch(actionFulfilled(name, payload))
			return payload
		}
		catch(e){
			dispatch(actionRejected(name, e))
		}
	}

export const actionPromiseClear = (name) => ({type: 'PROMISE_CLEAR', name});

export default actionPromise;