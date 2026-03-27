import {observer} from 'mobx-react-lite';
import {useContext} from "react";
import {Context} from "../../main";

export const HomePage = observer(() => {
    const {store} = useContext(Context);
    if (store.isLoading) return <div>Загрузка...</div>;

    return (
        <div>
            <h1>Главная страница</h1>
        </div>
    );
});