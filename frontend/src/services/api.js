const API_BASE_URL = 'http://127.0.0.1:8000'

class ApiService {
  // Login endpoint'i
  async login(email, password) {
    try {
      // FastAPI OAuth2PasswordRequestForm form-data bekliyor
      const formData = new FormData()
      formData.append('username', email) // email'i username olarak gönder
      formData.append('password', password)

      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Giriş başarısız')
      }

      const data = await response.json()
      // Token'ı localStorage'a kaydet
      localStorage.setItem('access_token', data.access_token)
      return data
    } catch (error) {
      throw error
    }
  }

  // Register endpoint'i
  async register(email, password, fullName = null) {
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Kayıt başarısız')
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Kullanıcı bilgilerini getir
  async getMe() {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        throw new Error('Token bulunamadı')
      }

      const response = await fetch(`${API_BASE_URL}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Kullanıcı bilgileri alınamadı')
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Logout
  logout() {
    localStorage.removeItem('access_token')
  }

  // Token kontrolü
  isAuthenticated() {
    return !!localStorage.getItem('access_token')
  }

  // Dosya yükleme
  async uploadFile(file) {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        throw new Error('Token bulunamadı')
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Dosya yüklenemedi')
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Kullanıcının dosyalarını getir
  async getUserFiles() {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        throw new Error('Token bulunamadı')
      }

      const response = await fetch(`${API_BASE_URL}/files`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Dosyalar alınamadı')
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Dosya sil
  async deleteFile(fileId) {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        throw new Error('Token bulunamadı')
      }

      const response = await fetch(`${API_BASE_URL}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Dosya silinemedi')
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }

  // Chat mesajı gönder
  async sendMessage(message) {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        throw new Error('Token bulunamadı')
      }

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Mesaj gönderilemedi')
      }

      return await response.json()
    } catch (error) {
      throw error
    }
  }
}

export default new ApiService()
