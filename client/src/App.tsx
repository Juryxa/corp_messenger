import {Navigate, Route, Routes} from 'react-router-dom';
import {observer} from 'mobx-react-lite';
import {useContext, useEffect} from 'react';
import {Context} from './main';
import ChatsPage from './pages/chats/ChatsPage';
import CalendarPage from './pages/calendar/CalendarPage';
import ContactsPage from './pages/contacts/ContactsPage';
import PollsPage from './pages/polls/PollsPage';
import AdminPage from './pages/admin/AdminPage';
import {MainLayout} from './layouts/MainLayout';
import {LoginPage} from './pages/login/LoginPage';
import {ChangePasswordPage} from './pages/change-password/ChangePasswordPage';
import {SessionsPage} from './pages/session/SessionsPage';
import {AdminRegisterPage} from './pages/admin/AdminRegisterPage';
import {RestoreKeyPage} from './components/RestoreKeyPage';
import {TotpPage} from "./pages/totp/TotpPage";
import {TotpSetupPage} from "./pages/totp/TotpSetupPage";

const App = observer(() => {
    const { store } = useContext(Context);

    // Первичная проверка при загрузке приложения
    useEffect(() => {
        store.checkAuth().then(() => {
            if (store.isAuth && !store.isTemporaryPassword && !store.isAwaitingTotp) {
                const hasKey = !!sessionStorage.getItem('privateKey');
                store.setNeedsKeyRestore(!hasKey);
            }
        });
    }, []);

    // Обновляем needsKeyRestore при изменении важных состояний
    useEffect(() => {
        if (store.isAuth &&
            !store.isTemporaryPassword &&
            !store.isAwaitingTotp &&
            !store.requireTotpSetup) {

            const hasKey = !!sessionStorage.getItem('privateKey');
            store.setNeedsKeyRestore(!hasKey);
        }
    }, [store.isAuth, store.isTemporaryPassword, store.isAwaitingTotp, store.requireTotpSetup]);

    // ─── Приоритет проверок ───
    if (store.isLoading) {
        return <div>Загрузка...</div>;
    }

    if (store.isAwaitingTotp) {
        return <TotpPage />;
    }

    if (store.isAuth && store.isTemporaryPassword) {
        return <ChangePasswordPage />;
    }

    if (store.isAuth && store.requireTotpSetup) {
        return <TotpSetupPage />;
    }

    if (store.isAuth && store.needsKeyRestore) {
        return <RestoreKeyPage onRestored={() => store.setNeedsKeyRestore(false)} />;
    }

    return (
        <Routes>
            <Route path="/login" element={store.isAuth ? <Navigate to="/chats" replace/> : <LoginPage/>}/>

            {store.isAuth ? (
                <Route element={<MainLayout/>}>
                    <Route path="/chats" element={<ChatsPage/>}/>
                    <Route path="/contacts" element={<ContactsPage/>}/>
                    <Route path="/calendar" element={<CalendarPage/>}/>
                    <Route path="/polls" element={<PollsPage/>}/>
                    <Route path="/sessions" element={<SessionsPage/>}/>
                    <Route path="/admin" element={<AdminPage/>}/>
                    <Route path="/admin/register" element={<AdminRegisterPage/>}/>
                    <Route path="*" element={<Navigate to="/chats" replace/>}/>
                </Route>
            ) : (
                <Route path="*" element={<Navigate to="/login" replace/>}/>
            )}
        </Routes>
    );
});

export default App;