from datetime import datetime, timedelta
from typing import Optional, Annotated
import os
import shutil
from pathlib import Path
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Column, Integer, String, DateTime, create_engine, select
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from passlib.context import CryptContext
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError


JWT_SECRET = "CHANGE_ME_USE_ENV"
JWT_ALG = "HS256"
ACCESS_TOKEN_EXPIRE_MIN = 60  # dakika

DATABASE_URL = "sqlite:///./app.db"
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


# =========================================================
# DB Kurulum
# =========================================================
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class UploadedFile(Base):
    __tablename__ = "uploaded_files"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    filename = Column(String(255), nullable=False)  # Orijinal dosya adı
    saved_filename = Column(String(255), nullable=False)  # Sunucuda kaydedilen ad
    file_path = Column(String(500), nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String(100), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class NotificationSettings(Base):
    __tablename__ = "notification_settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, unique=True, nullable=False, index=True)
    email_notifications = Column(Integer, default=1)  # 0 veya 1 (boolean gibi)
    email_notification_time = Column(String(5), default="09:00")  # HH:MM formatı
    push_notifications = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =========================================================
# Güvenlik / Parola / JWT
# =========================================================
# bcrypt_sha256: önce parolayı SHA256’lar sonra bcrypt uygular (şifre politikaları için pratik).
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(sub: str, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MIN) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode = {"sub": sub, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


# HTTP Bearer: Swagger’da tek alanlı token girişi sağlar
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Bearer token gerekli")


    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        email: Optional[str] = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Token'da 'sub' yok")
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token süresi dolmuş")
    except JWTError:
        raise HTTPException(status_code=401, detail="Geçersiz token")


    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    return user


# =========================================================
# Şema (Pydantic)
# =========================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True  # SQLAlchemy objelerini otomatik dönüştür


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UploadedFileOut(BaseModel):
    id: int
    filename: str
    saved_filename: str
    file_size: int
    file_type: Optional[str] = None
    uploaded_at: datetime
    class Config:
        from_attributes = True


class NotificationSettingsIn(BaseModel):
    email_notifications: bool = False
    email_notification_time: str = "09:00"
    push_notifications: bool = False


class NotificationSettingsOut(BaseModel):
    email_notifications: bool
    email_notification_time: str
    push_notifications: bool
    updated_at: datetime
    class Config:
        from_attributes = True


class ChatMessageIn(BaseModel):
    message: str = Field(min_length=1, max_length=5000)


class ChatMessageOut(BaseModel):
    user_message: str
    bot_response: str
    timestamp: datetime


# =========================================================
# FastAPI Uygulaması
# =========================================================
app = FastAPI(
    title="Auth API (FastAPI)",
    swagger_ui_parameters={
        # Swagger yeniden yüklendiğinde yetkiyi koru (çok kullanışlı)
        "persistAuthorization": True
    },
)

# CORS Middleware Ekle
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # React dev sunucusu
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ------------------------ Register ------------------------
@app.post("/register", response_model=UserOut, status_code=201)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    exists = db.scalar(select(User).where(User.email == payload.email))
    if exists:
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı")


    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# ------------------------ Login ---------------------------
# (Form-data: username, password)
@app.post("/login", response_model=TokenOut)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == form.username))
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Email veya parola hatalı")
    token = create_access_token(sub=user.email)
    return TokenOut(access_token=token)


# ------------------------ Profil --------------------------
@app.get("/me", response_model=UserOut)
def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


# ------------------------ Dosya Yükleme -------------------
@app.post("/upload", response_model=UploadedFileOut)
async def upload_file(
    file: UploadFile = File(...),
    current_user: Annotated[User, Depends(get_current_user)] = None,
    db: Session = Depends(get_db)
):
    """
    Dosya yükleme endpoint'i.
    Sadece authentication yapılmış kullanıcılar dosya yükleyebilir.
    İzin verilen dosya tipleri: audio/*, .png, .jpg, .jpeg
    """
    
    # Dosya uzantısını kontrol et
    file_extension = file.filename.split('.')[-1].lower() if '.' in file.filename else ''
    allowed_extensions = ['png', 'jpg', 'jpeg', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
    
    if file_extension not in allowed_extensions and not file.content_type.startswith('audio/'):
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya tipi. İzin verilen: {', '.join(allowed_extensions)} veya ses dosyaları"
        )
    
    # Benzersiz dosya adı oluştur (timestamp + original filename)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = UPLOAD_DIR / safe_filename
    
    # Dosyayı kaydet
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dosya yüklenirken hata oluştu: {str(e)}")
    
    # Veritabanına kaydet
    file_size = file_path.stat().st_size
    db_file = UploadedFile(
        user_id=current_user.id,
        filename=file.filename,
        saved_filename=safe_filename,
        file_path=str(file_path),
        file_size=file_size,
        file_type=file.content_type
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    return db_file


# ------------------------ Kullanıcının Dosyalarını Getir ---
@app.get("/files", response_model=list[UploadedFileOut])
def get_user_files(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Giriş yapan kullanıcının yüklediği tüm dosyaları getirir.
    """
    files = db.scalars(
        select(UploadedFile)
        .where(UploadedFile.user_id == current_user.id)
        .order_by(UploadedFile.uploaded_at.desc())
    ).all()
    return files


# ------------------------ Dosya Silme ---------------------
@app.delete("/files/{file_id}")
def delete_file(
    file_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Kullanıcının dosyasını siler (hem DB'den hem sunucudan).
    """
    # Dosyayı bul
    db_file = db.scalar(
        select(UploadedFile)
        .where(UploadedFile.id == file_id, UploadedFile.user_id == current_user.id)
    )
    
    if not db_file:
        raise HTTPException(status_code=404, detail="Dosya bulunamadı")
    
    # Fiziksel dosyayı sil
    try:
        file_path = Path(db_file.file_path)
        if file_path.exists():
            file_path.unlink()
    except Exception as e:
        print(f"Dosya silinirken hata: {e}")
    
    # Veritabanından sil
    db.delete(db_file)
    db.commit()
    
    return {"message": "Dosya başarıyla silindi", "filename": db_file.filename}


# ------------------------ Chat Endpoint -------------------
@app.post("/chat", response_model=ChatMessageOut)
def chat(
    payload: ChatMessageIn,
    current_user: Annotated[User, Depends(get_current_user)]
):
    """
    Chat endpoint'i. Kullanıcının mesajını alır ve bot cevabı döner.
    Şimdilik basit bir cevap dönüyor, ileride AI model entegrasyonu yapılabilir.
    """
    user_message = payload.message.strip()
    
    # Basit bot cevapları (ileride AI model ile değiştirilebilir)
    bot_response = f"Mesajınızı aldım: '{user_message}'. Bu bir demo cevaptır. İleride AI modeli entegre edilecek."
    
    # Eğer mesaj belirli kelimeler içeriyorsa özel cevaplar
    if "merhaba" in user_message.lower() or "selam" in user_message.lower():
        bot_response = f"Merhaba {current_user.full_name or 'değerli kullanıcı'}! Size nasıl yardımcı olabilirim?"
    elif "nasılsın" in user_message.lower() or "nasilsin" in user_message.lower():
        bot_response = "İyiyim, teşekkür ederim! Sizin için buradayım. Size nasıl yardımcı olabilirim?"
    elif "dosya" in user_message.lower():
        bot_response = "Dosyalarınızı sol taraftaki panelden yönetebilirsiniz. Yeni dosya yüklemek için + butonunu kullanabilirsiniz."
    elif "yardım" in user_message.lower() or "help" in user_message.lower():
        bot_response = "Size yardımcı olmaktan mutluluk duyarım! Dosya yükleme, listeleme ve silme işlemleri yapabilirsiniz. Ayrıca benimle sohbet edebilirsiniz."
    
    return ChatMessageOut(
        user_message=user_message,
        bot_response=bot_response,
        timestamp=datetime.utcnow()
    )


# =========================================================
# Bildirim Ayarları Endpoints
# =========================================================
@app.get("/notification-settings", response_model=NotificationSettingsOut)
def get_notification_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Kullanıcının mevcut bildirim ayarlarını getirir.
    Eğer kayıt yoksa varsayılan değerlerle oluşturur.
    """
    settings = db.scalar(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    
    if not settings:
        # Varsayılan ayarları oluştur
        settings = NotificationSettings(
            user_id=current_user.id,
            email_notifications=0,
            email_notification_time="09:00",
            push_notifications=0
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return NotificationSettingsOut(
        email_notifications=bool(settings.email_notifications),
        email_notification_time=settings.email_notification_time,
        push_notifications=bool(settings.push_notifications),
        updated_at=settings.updated_at
    )


@app.post("/notification-settings", response_model=NotificationSettingsOut)
def update_notification_settings(
    settings_in: NotificationSettingsIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Kullanıcının bildirim ayarlarını günceller.
    Kayıt yoksa yeni oluşturur.
    """
    settings = db.scalar(
        select(NotificationSettings).where(NotificationSettings.user_id == current_user.id)
    )
    
    if settings:
        # Mevcut ayarları güncelle
        settings.email_notifications = int(settings_in.email_notifications)
        settings.email_notification_time = settings_in.email_notification_time
        settings.push_notifications = int(settings_in.push_notifications)
        settings.updated_at = datetime.utcnow()
    else:
        # Yeni ayar kaydı oluştur
        settings = NotificationSettings(
            user_id=current_user.id,
            email_notifications=int(settings_in.email_notifications),
            email_notification_time=settings_in.email_notification_time,
            push_notifications=int(settings_in.push_notifications)
        )
        db.add(settings)
    
    db.commit()
    db.refresh(settings)
    
    return NotificationSettingsOut(
        email_notifications=bool(settings.email_notifications),
        email_notification_time=settings.email_notification_time,
        push_notifications=bool(settings.push_notifications),
        updated_at=settings.updated_at
    )

