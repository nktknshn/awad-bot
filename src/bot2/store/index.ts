import { combineReducers, configureStore, getDefaultMiddleware } from '@reduxjs/toolkit'
import logger from 'redux-logger'
import { Services } from '../services'
import pathReducer from './path'
import trainerReducer from './trainer'
import userReducer from './user'
import settingsReducer from './settings'
import miscReducer from './misc'
import thunk from 'redux-thunk';

// type Actions = 

const rootReducer = combineReducers({
    user: userReducer,
    path: pathReducer,
    trainer: trainerReducer,
    settings: settingsReducer,
    misc: miscReducer
})

export type RootState = ReturnType<typeof rootReducer>

export function createStore(services: Services) {
    return configureStore({
        reducer: rootReducer,
        middleware: getDefaultMiddleware({
            thunk: { extraArgument: services },
            serializableCheck: false
        }).concat(logger)
    })

}