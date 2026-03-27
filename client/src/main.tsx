import {createContext} from 'react'
import {createRoot} from 'react-dom/client'
import App from './App.tsx'
import './App.css'

import Store from "./store/store";
import {BrowserRouter} from "react-router-dom";

interface State {
    store: Store,
}

export const store = new Store();

export const Context = createContext<State>({
    store,
})

createRoot(document.getElementById('root')!).render(
    // <StrictMode>
        <BrowserRouter>
            <Context.Provider value={{store}}>
                <App/>
            </Context.Provider>
        </BrowserRouter>
    // </StrictMode>
)
