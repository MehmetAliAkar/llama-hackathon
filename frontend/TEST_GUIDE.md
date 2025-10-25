# Test API Kullanımı

## Backend Çalışıyor ✅
- Backend: http://127.0.0.1:8000
- API Docs: http://127.0.0.1:8000/docs
- Frontend: http://localhost:5173

## Test için kullanıcı oluşturma

PowerShell'de şu komutu çalıştırarak test kullanıcısı oluşturabilirsiniz:

```powershell
$body = @{
    email = "test@example.com"
    password = "test12345"
    full_name = "Test Kullanıcı"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/register" -Method POST -Body $body -ContentType "application/json"
```

## Veya tarayıcıdan:
1. http://127.0.0.1:8000/docs adresine gidin
2. POST /register endpoint'ini açın
3. "Try it out" butonuna tıklayın
4. Aşağıdaki JSON'u yapıştırın:
```json
{
  "email": "test@example.com",
  "password": "test12345",
  "full_name": "Test Kullanıcı"
}
```
5. "Execute" butonuna tıklayın

## Sonra Login Sayfasında Test Edin:
- Email: test@example.com
- Password: test12345
