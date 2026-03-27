import {NavLink} from "react-router-dom";


const CalendarPage = () => {
    return (
        <div>
            Календарь
            <NavLink to={'/home'}>
                На главную
            </NavLink>
        </div>
    );
};

export default CalendarPage;