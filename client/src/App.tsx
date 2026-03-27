import {Navigate, Route, Routes} from 'react-router-dom';
import {HomePage} from './pages/home/HomePage';
import {observer} from 'mobx-react-lite';
import {useContext, useEffect} from 'react';
import {Context} from './main';

import ChatsPage from './pages/chats/ChatsPage';
import CalendarPage from './pages/calendar/CalendarPage';
import ContactsPage from './pages/contacts/ContactsPage';
import StoragePage from './pages/storage/StoragePage';
import PollsPage from './pages/polls/PollsPage';
import AdminPage from './pages/admin/AdminPage';
import {MainLayout} from './layouts/MainLayout';
import {LoginPage} from './pages/login/LoginPage';
import {ChangePasswordPage} from './pages/change-password/ChangePasswordPage';
import {SessionsPage} from './pages/session/SessionsPage';
import {AdminRegisterPage} from './pages/admin/AdminRegisterPage';

const App = observer(() => {
    const {store} = useContext(Context);

    // 🔐 Проверка авторизации при старте
    useEffect(() => {
        store.checkAuth();
    }, []);


    if (store.isLoading) {
        return <div>Загрузка...</div>;
    }

    // 🔒 Если временный пароль — блокируем всё
    if (store.isAuth && store.isTemporaryPassword) {
        return <ChangePasswordPage/>;
    }

    return (
        <Routes>
            {/* 🟢 Публичный маршрут */}
            <Route path="/login" element={store.isAuth ? <Navigate to="/home" replace/> : <LoginPage/>}/>

            {/* 🔐 Защищённые маршруты */}
            {store.isAuth ? (
                <Route element={<MainLayout/>}>
                    <Route path="/home" element={<HomePage/>}/>
                    <Route path="/chats" element={<ChatsPage/>}/>
                    <Route path="/contacts" element={<ContactsPage/>}/>
                    <Route path="/storage" element={<StoragePage/>}/>
                    <Route path="/calendar" element={<CalendarPage/>}/>
                    <Route path="/polls" element={<PollsPage/>}/>
                    <Route path="/sessions" element={<SessionsPage/>}/>
                    <Route path="/admin" element={<AdminPage/>}/>
                    <Route path="/admin/register" element={<AdminRegisterPage/>}/>
                    <Route path="*" element={<Navigate to="/home" replace/>}/>
                </Route>
            ) : (
                <Route path="*" element={<Navigate to="/login" replace/>}/>
            )}

        </Routes>
    );
});

export default App;