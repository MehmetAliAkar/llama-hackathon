import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './LoginScreen.css'

const LoginScreen = ({ onLoginSuccess }) => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  const validateForm = () => {
    const newErrors = {}
    
    if (!email) {
      newErrors.email = 'E-posta adresi gereklidir'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Geçerli bir e-posta adresi giriniz'
    }
    
    if (!password) {
      newErrors.password = 'Şifre gereklidir'
    } else if (password.length < 6) {
      newErrors.password = 'Şifre en az 6 karakter olmalıdır'
    }
    
    return newErrors
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    const newErrors = validateForm()
    setErrors(newErrors)
    setSuccessMessage('')
    
    if (Object.keys(newErrors).length === 0) {
      setIsLoading(true)
      
      try {
        // API'ye login isteği gönder
        const response = await apiService.login(email, password)
        
        // Başarılı giriş
        setSuccessMessage('Giriş başarılı! Yönlendiriliyorsunuz...')
        
        // Kullanıcı bilgilerini al ve dashboard'a yönlendir
        setTimeout(async () => {
          try {
            const userInfo = await apiService.getMe()
            // Dashboard'a geç
            if (onLoginSuccess) {
              onLoginSuccess(userInfo)
            }
            navigate('/dashboard')
          } catch (error) {
            console.error('Kullanıcı bilgileri alınamadı:', error)
            setErrors({ 
              submit: 'Kullanıcı bilgileri alınamadı' 
            })
          }
        }, 500)
        
      } catch (error) {
        // Hata durumu
        setErrors({ 
          submit: error.message || 'Giriş yapılırken bir hata oluştu' 
        })
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" fill="#4F46E5"/>
              <path d="M24 16L28 24L24 32L20 24L24 16Z" fill="white"/>
            </svg>
          </div>
          <h1>Hoş Geldiniz</h1>
          <p>Hesabınıza giriş yapın</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {successMessage && (
            <div className="success-message">
              {successMessage}
            </div>
          )}
          
          {errors.submit && (
            <div className="error-banner">
              {errors.submit}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">E-posta Adresi</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className={errors.email ? 'error' : ''}
              />
              <span className="input-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                </svg>
              </span>
            </div>
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Şifre</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={errors.password ? 'error' : ''}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          <div className="form-options">
            <label className="checkbox-label">
              <input type="checkbox" />
              <span>Beni hatırla</span>
            </label>
            <a href="#" className="forgot-password">Şifremi unuttum</a>
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loading-spinner"></span>
            ) : (
              'Giriş Yap'
            )}
          </button>
        </form>

        <div className="signup-link">
          Hesabınız yok mu? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Kayıt olun</a>
        </div>
      </div>
    </div>
  )
}

export default LoginScreen
