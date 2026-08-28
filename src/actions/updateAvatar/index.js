import actionAvatar from "../avatar";
import actionAboutMe from "../aboutMe";
import { actionPromiseClear } from "../promise";

const actionUpdateAvatar = () =>
    async (dispatch, getState) => {
        const myId = getState().auth?.payload?.sub?.id;
        const fileId = getState().promise?.upload?.payload?._id;
        await dispatch(actionAvatar(myId, fileId));
        await dispatch(actionAboutMe());
        dispatch(actionPromiseClear('upload'));
    }

export default actionUpdateAvatar;