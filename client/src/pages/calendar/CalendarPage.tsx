import {NavLink} from "react-router-dom";


const CalendarPage = () => {
    return (
        <div>
            Календарь
            <NavLink to={'/chats'}>
                На главную
            </NavLink>
        </div>
    );
};

export default CalendarPage;