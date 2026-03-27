import {NavLink} from "react-router-dom";

const StoragePage = () => {
    return (
        <div>
            Облачное хранилище
            <NavLink to={'/home'}>
                На главную
            </NavLink>
        </div>
    );
};

export default StoragePage;