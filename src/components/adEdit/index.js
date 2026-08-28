import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useDropzone } from 'react-dropzone';
import { useParams, useNavigate } from "react-router-dom";

import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    SortableContext,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { arrayMoveImmutable } from 'array-move';

import Button from '@mui/material/Button';
import TextField from "@mui/material/TextField";
import { FormControl, InputAdornment, InputLabel, OutlinedInput } from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';

import actionAd from "../../actions/ad";
import actionOne from "../../actions/adOne";
import actionUploadFile from "../../actions/uploadFile";
import { actionPromiseClear } from "../../actions/promise";

import config from "../../config";

import '../../_assets/scss/_pages/adEdit.scss';

const focusedStyle = {
    borderColor: '#2196f3'
};

const acceptStyle = {
    borderColor: '#00e676'
};

const rejectStyle = {
    borderColor: '#ff1744'
};

const SortableItem = (props) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id: props.id });

    const itemStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: "grab"
    };

    const Render = props.render

    return (
        <div style={itemStyle} ref={setNodeRef} {...attributes} {...listeners}>
            <Render {...{ [props.itemProp]: props.item }} />
        </div>
    );
};

const Droppable = ({ id, items, itemProp, keyField, render }) => {
    return (
        <SortableContext id={id}
            items={items}
            strategy={rectSortingStrategy}
        >
            {items.map((item) => (
                <SortableItem render={render}
                    key={item[keyField]}
                    id={item}
                    itemProp={itemProp}
                    item={item}
                />
            ))}
        </SortableContext>
    );
};

const Dnd = ({ items: startItems, render, itemProp, keyField, onChange, horizontal }) => {
    const [items, setItems] = useState(startItems);

    useEffect(() => setItems(startItems), [startItems])

    useEffect(() => {
        if (typeof onChange === 'function') {
            onChange(items)
        }
    }, [items])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    const handleDragEnd = ({ active, over }) => {
        const activeIndex = active.data.current.sortable.index;
        const overIndex = over.data.current?.sortable.index || 0;

        setItems((items) => {
            return arrayMoveImmutable(items, activeIndex, overIndex)
        });
    }

    const containerStyle = { display: horizontal ? "flex" : '' };

    return (
        <DndContext sensors={sensors}
            onDragEnd={handleDragEnd}
        >
            <div className="ad-edit__image-list"
                style={containerStyle}
            >
                <Droppable id="aaa"
                    items={items}
                    itemProp={itemProp}
                    keyField={keyField}
                    render={render}
                />
            </div>
        </DndContext>
    );
}

const ImageItem = ({ image, onDelete }) => {
    return (
        <div className="ad-edit__image-figure"
        >
            <img className="ad-edit__image"
                key={image._id}
                alt={'image_' + image._id}
                src={config.backendURL + image.url}
            />
            <Button className="ad-edit__image-delete-button"
                onClick={() => onDelete(image)}
            >
                <DeleteIcon />
            </Button>
        </div>
    )
}

const AdEdit = ({ onSave, onUpload, oldAd }) => {
    const navigate = useNavigate();
    const [ad, setAd] = useState({ images: [], title: '', description: '', price: 0 });

    const deleteImage = image => setAd({ ...ad, images: ad.images.filter(i => i !== image) })

    const AdImageItem = ({ image }) => {
        return (
            <ImageItem image={image}
                onDelete={imgToDelete => deleteImage(imgToDelete)}
            />
        )
    }

    const {
        getRootProps,
        getInputProps,
        acceptedFiles,
        isFocused,
        isDragAccept,
        isDragReject
    } = useDropzone({
        accept: {
            'image/*': []
        },
        maxFiles: 1
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
        if (acceptedFiles && acceptedFiles.length > 0) {
            acceptedFiles.forEach(async (file) => {
                const uploadedFile = await onUpload(file);
                if (uploadedFile) {
                    setAd(prevAd => ({ ...prevAd, images: [...prevAd.images, uploadedFile] }));
                }
            });
        }
    }, [acceptedFiles]);

    useEffect(() => {
        if (oldAd) {
            const { _id, price, title, description, images } = oldAd;
            setAd({ _id, price, title, description, images });
        }
    }, [oldAd]);

    return (
        <div className="ad-edit">
            <h1>Create new ad</h1>
            <TextField margin="normal"
                required
                fullWidth
                id="text"
                label="Title"
                name="text"
                autoComplete="text"
                value={ad.title}
                onChange={(e) => setAd({ ...ad, title: e.target.value })}
            />
            <TextField margin="normal"
                required
                fullWidth
                id="standard-multiline-static"
                label="Description"
                name="text"
                autoComplete="text"
                multiline
                rows={4}
                value={ad.description}
                onChange={(e) => setAd({ ...ad, description: e.target.value })}
            />
            <FormControl fullWidth margin="normal">
                <InputLabel htmlFor="price">Amount</InputLabel>
                <OutlinedInput id="price"
                    value={ad.price}
                    onChange={(e) => setAd({ ...ad, price: +(e.target.value) })}
                    startAdornment={<InputAdornment position="start">₴</InputAdornment>}
                    label="Price"
                />
            </FormControl>

            <section className="dropzone container">
                <div className="dropzone__element" {...getRootProps({ style })}>
                    <input {...getInputProps()} />
                    <p>Drag 'n' drop some files here, or click to select files</p>
                </div>
            </section>

            {ad.images.length > 0 && <Dnd items={ad.images}
                render={AdImageItem}
                itemProp="image"
                keyField="_id"
                onChange={images => setAd({ ...ad, images })}
            />
            }

            <Button variant="contained"
                sx={{ mt: 2 }}
                onClick={() => {
                    onSave(ad);
                    navigate(`/`);
                }}
            >Save</Button>

        </div>
    )
}

const AdEditRedux = ({ loadOld }) => {
    const oneAd = useSelector(state => state.promise?.one?.payload);
    const dispatch = useDispatch();
    const params = useParams();

    useEffect(() => {
        dispatch(actionPromiseClear('upload'));
        if (params.adID) {
            dispatch(actionOne(params.adID));
        }
        return () => {
            dispatch(actionPromiseClear('upload'));
            if (params.adID) {
                dispatch(actionPromiseClear('one'));
            }
        };
    }, [params.adID]);

    return (
        <AdEdit onUpload={(file) => dispatch(actionUploadFile(file))}
            onSave={(ad) => dispatch(actionAd({ ...ad }))}
            oldAd={loadOld ? oneAd : false}
        />
    )
}

export default AdEditRedux;