import {useState, useMemo, useEffect} from 'react';
import {useDispatch, useSelector} from "react-redux";
import {useDropzone} from 'react-dropzone';

import Button from '@mui/material/Button';
import Box from "@mui/material/Box";
import Modal from '@mui/material/Modal';

import actionUploadFile from "../../actions/uploadFile";
import actionUpdateAvatar from "../../actions/updateAvatar";
import { actionPromiseClear } from "../../actions/promise";

const focusedStyle = {
	borderColor: '#2196f3'
};

const acceptStyle = {
	borderColor: '#00e676'
};

const rejectStyle = {
	borderColor: '#ff1744'
};

const UploadDialog = ({onUpload, onUpdateAvatar, fileDataUpload, isOpen, handleClose}) => {
	const [files, setFiles] = useState([]);

	const {
		getRootProps,
		getInputProps,
		fileRejections,
		acceptedFiles,
		isFocused,
		isDragAccept,
		isDragReject
	} = useDropzone({
		accept: {
			'image/*': []
		},
		maxFiles: 1,
		onDrop: acceptedFiles => {
			setFiles(acceptedFiles.map(file => Object.assign(file, {
				preview: URL.createObjectURL(file)
			})));
			// setOpen(false);
		}
	});

	const style = useMemo(() => ({
		...(isFocused ? focusedStyle : {}),
		...(isDragAccept ? acceptStyle : {}),
		...(isDragReject ? rejectStyle : {})
	}), [
		isFocused,
		isDragAccept,
		isDragReject
	]);

	useEffect(() => {
		acceptedFiles.map(file => onUpload(file));
	}, [acceptedFiles[0]]);

	const thumbs = files.map(file => (
		<figure className="dropzone__thumbs"
		        key={file.name}
		>
			<div className="dropzone__thumb">
				<div className="dropzone__thumb-inner">
					<img src={file.preview}
					     className="dropzone__thumb-img"
						// Revoke data uri after image is loaded
						 onLoad={() => { URL.revokeObjectURL(file.preview) }}
						 alt={file.name}
					/>
				</div>
			</div>
			<figcaption>{file.path} - {file.size} bytes</figcaption>
		</figure>
	));

	useEffect(() => {
		// Make sure to revoke the data uris to avoid memory leaks, will run on unmount
		return () => files.forEach(file => URL.revokeObjectURL(file.preview));
	}, [files]);

	const fileRejectionItems = fileRejections.map(({ file, errors  }) => {
		return (
			<li key={file.path}>
				{file.path} - {file.size} bytes
				<ul>
					{errors.map(e => <li key={e.code}>{e.message}</li>)}
				</ul>
			</li>
		)
	});

	return (
		<Modal
			open={isOpen}
			onClose={handleClose}
			aria-labelledby="modal-modal-title"
			aria-describedby="modal-modal-description"
		>
			<Box className="dropzone-container">
				<section className="dropzone container">
					<div className="dropzone__element" {...getRootProps({style})}>
						<input {...getInputProps()} />
						<p>Drag 'n' drop some files here, or click to select files</p>
						<em>(1 file are the maximum number of files you can drop here)</em>
					</div>
					<aside className="dropzone__thumbs-container">
						{thumbs.length !== 0 && <>
							<h4>Accepted files</h4>
							{thumbs}
						</>}
						{fileRejectionItems.length !== 0 && <>
							<h4>Rejected files</h4>
							<ul>{fileRejectionItems}</ul>
						</>}
					</aside>
					<Box sx={{mt:2}}>
						<Button variant="contained"
								onClick={() => {
									onUpdateAvatar();
									handleClose()
								}}
								disabled={(!(fileDataUpload && fileDataUpload.status === 'FULFILLED'))}
						>Save</Button>
					</Box>
				</section>
			</Box>
		</Modal>
	);
}

const UploadDialogRedux = ({isOpen, handleClose}) => {
	const upload = useSelector(state => state.promise.upload)
	const dispatch = useDispatch();

	const onClose = () => {
		dispatch(actionPromiseClear('upload'));
		if (handleClose) {
			handleClose();
		}
	}

	useEffect(() => {
		dispatch(actionPromiseClear('upload'));
		return () => {
			dispatch(actionPromiseClear('upload'));
		}
	}, []);

	return(
		<UploadDialog isOpen={isOpen}
					  handleClose={onClose}
					  onUpload={(file) => dispatch(actionUploadFile(file))}
					  onUpdateAvatar={() => dispatch(actionUpdateAvatar())}
					  fileDataUpload={upload}
		/>
	)
}

export default UploadDialogRedux;