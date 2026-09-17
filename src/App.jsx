import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import Home from './pages/Home'
import Placeholder from './pages/Placeholder'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <div className="app">
          <header className="app-header">
            <h1>Organizador de Gastos</h1>
            <nav>
              <NavLink to="/" end>
                Inicio
              </NavLink>
              <NavLink to="/gastos">Gastos</NavLink>
              <NavLink to="/wishlist">Wishlist</NavLink>
            </nav>
          </header>
          <main>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/gastos" element={<Placeholder title="Gastos" />} />
              <Route path="/wishlist" element={<Placeholder title="Wishlist" />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}
