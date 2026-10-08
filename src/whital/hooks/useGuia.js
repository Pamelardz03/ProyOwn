import { createContext, useContext } from 'react'

// Dice si hay una guía animada en curso. Las pantallas lo usan para mostrar un ejemplo
// falso (no se guarda en la base de datos) cuando su lista está vacía.
export const GuiaContext = createContext({ activa: false, setActiva: () => {} })
export const useGuia = () => useContext(GuiaContext)
