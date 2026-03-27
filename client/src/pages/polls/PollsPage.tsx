import {NavLink} from "react-router-dom";

const PollsPage = () => {
    return (
        <div>
            Опросы
            <NavLink to={'/home'}>
                На главную
            </NavLink>
        </div>
    );
};

export default PollsPage;