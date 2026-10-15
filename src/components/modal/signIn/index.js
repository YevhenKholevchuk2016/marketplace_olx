import {useEffect, useState} from 'react';
import {useDispatch} from "react-redux";

import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import Button from "@mui/material/Button";
import TextField from '@mui/material/TextField';
import TabsUnstyled from '@mui/base/TabsUnstyled';
import TabsListUnstyled from '@mui/base/TabsListUnstyled';
import TabPanelUnstyled from '@mui/base/TabPanelUnstyled';
import TabUnstyled from '@mui/base/TabUnstyled';
import LinearProgress from "@mui/material/LinearProgress";

import actionFullLogin from "../../../actions/auth/fullLogin";
import actionFullRegister from "../../../actions/auth/fullRegister";
import config from "../../../config";

import "../../../_assets/scss/_pages/signin.scss"

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const SignInModal = ({onSignIn, onRegister, isOpen, handleClose}) => {
	const [loginSignIn, setLoginSignIn] = useState('');
	const [passwordSignIn, setPasswordSignIn] = useState('');
	const [loginRegister, setLoginRegister] = useState('');
	const [passwordRegister, setPasswordRegister] = useState('');

	const [signInErrors, setSignInErrors] = useState({});
	const [registerErrors, setRegisterErrors] = useState({});

	const [backendIsLoaded, setBackendIsLoaded] = useState(false);
	const [isSignInClicked, setIsSignInClicked] = useState(false);
	const [isRegisterClicked, setIsRegisterClicked] = useState(false);

	useEffect(() => {
		// Reset on any close, including when the parent sets isOpen to false directly.
		if (!isOpen) {
			setIsSignInClicked(false);
			setIsRegisterClicked(false);
		}
	}, [isOpen]);

	useEffect(() => {
		// Render's free tier sleeps when idle; the request resolves once the server is awake.
		fetch(config.backendURL)
			.then(() => setBackendIsLoaded(true))
			.catch(() => {});
	}, []);

	const renderBackendNotification = (isClicked) => isClicked && !backendIsLoaded && (
		<div className="modal__notification">
			<LinearProgress />
			<p className="overlay-title">Let's connect to the service…</p>
			<p className="overlay-sub">This project uses a free cloud hosting platform called Render.<br/>It may take 10 to 30 seconds to load. Please wait a moment.</p>
		</div>
	);

	// Validation runs only on submit; a failed check blocks the request and shows the errors.
	const handleSignInClick = () => {
		const errors = {};
		if (!loginSignIn.trim()) errors.email = 'Email is required';
		if (!passwordSignIn) errors.password = 'Password is required';
		setSignInErrors(errors);
		if (Object.keys(errors).length) return;

		setIsSignInClicked(true);
		onSignIn(loginSignIn, passwordSignIn);
	};

	const handleRegisterClick = () => {
		const errors = {};
		if (!loginRegister.trim()) errors.email = 'Email is required';
		else if (!EMAIL_PATTERN.test(loginRegister.trim())) errors.email = 'Enter a valid email address';
		if (!passwordRegister) errors.password = 'Password is required';
		setRegisterErrors(errors);
		if (Object.keys(errors).length) return;

		setIsRegisterClicked(true);
		onRegister(loginRegister, passwordRegister);
	};

	return (
		<Modal className="modal"
			   open={isOpen}
			   onClose={handleClose}
			   aria-labelledby="modal-modal-title"
			   aria-describedby="modal-modal-description"
		>
			<Box className="modal__content">

				<TabsUnstyled defaultValue={0}>
					<TabsListUnstyled className="modal__tab-list">
						<TabUnstyled className="modal__tab-list-item">Sign in</TabUnstyled>
						<TabUnstyled className="modal__tab-list-item">Register</TabUnstyled>
					</TabsListUnstyled>
					<TabPanelUnstyled value={0}>
						<Box sx={{
							marginTop: 2,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
						}}
						>
							<Box component="div">
								{renderBackendNotification(isSignInClicked)}
								<TextField margin="normal"
										   required
										   fullWidth
										   id="email"
										   label="Email Address"
										   name="email"
										   autoComplete="email"
										   value={loginSignIn}
										   error={!!signInErrors.email}
										   helperText={signInErrors.email}
										   onChange={(e) => setLoginSignIn(e.target.value)}
								/>
								<TextField margin="normal"
										   required
										   fullWidth
										   name="password"
										   label="Password"
										   type="password"
										   id="password"
										   autoComplete="current-password"
										   value={passwordSignIn}
										   error={!!signInErrors.password}
										   helperText={signInErrors.password}
										   onChange={(e) => setPasswordSignIn(e.target.value)}
								/>
								<Button type="submit"
										fullWidth
										variant="contained"
										sx={{mt: 3}}
										onClick={handleSignInClick}
								>Sign In</Button>
							</Box>
						</Box>
					</TabPanelUnstyled>
					<TabPanelUnstyled value={1}>
						<Box sx={{
							marginTop: 2,
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
						}}
						>
							<Box component="div">
								{renderBackendNotification(isRegisterClicked)}
								<TextField margin="normal"
										   required
										   fullWidth
										   id="email"
										   label="Email Address"
										   name="email"
										   autoComplete="email"
										   value={loginRegister}
										   error={!!registerErrors.email}
										   helperText={registerErrors.email}
										   onChange={(e) => setLoginRegister(e.target.value)}
								/>
								<TextField margin="normal"
										   required
										   fullWidth
										   name="password"
										   label="Password"
										   type="password"
										   id="password"
										   autoComplete="current-password"
										   value={passwordRegister}
										   error={!!registerErrors.password}
										   helperText={registerErrors.password}
										   onChange={(e) => setPasswordRegister(e.target.value)}
								/>
								<Button type="submit"
										fullWidth
										variant="contained"
										sx={{ mt: 3 }}
										onClick={handleRegisterClick}
								>Register</Button>
							</Box>
						</Box>
					</TabPanelUnstyled>
				</TabsUnstyled>

			</Box>
		</Modal>
	);
}

const SignInModalRedux = ({isOpen, handleClose}) => {
	const dispatch = useDispatch();
	return(
		<SignInModal isOpen={isOpen}
					 handleClose={handleClose}
					 onSignIn={(loginSignIn, passwordSignIn) => dispatch(actionFullLogin(loginSignIn, passwordSignIn))}
		             onRegister={(loginRegister, passwordRegister) => dispatch(actionFullRegister(loginRegister, passwordRegister))}
		/>
	);
}

export default SignInModalRedux;
