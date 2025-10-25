import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginScreen from './components/LoginScreen'
import RegisterScreen from './components/RegisterScreen'
import Dashboard from './components/Dashboard'
import apiService from './services/api'
import './App.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Sayfa yüklendiğinde token varsa kullanıcı bilgilerini al
  useEffect(() => {
    const checkAuth = async () => {
      if (apiService.isAuthenticated()) {
        try {
          const userInfo = await apiService.getMe()
          setCurrentUser(userInfo)
        } catch (error) {
          console.error('Token geçersiz veya süresi dolmuş:', error)
          // Token geçersizse temizle
          apiService.logout()
        }
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const handleLoginSuccess = (user) => {
    // Login başarılı, dashboard'a geç
    setCurrentUser(user)
  }

  const handleLogout = () => {
    // Çıkış yap
    apiService.logout()
    setCurrentUser(null)
  }

  // Auth kontrolü yapılırken loading göster
  if (isLoading) {
    return (
      <div className="App" style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner-large"></div>
          <p style={{ marginTop: '20px', color: '#6b7280' }}>Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              currentUser ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
              )
            } 
          />
          <Route 
            path="/register" 
            element={
              currentUser ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <RegisterScreen />
              )
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              currentUser ? (
                <Dashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
