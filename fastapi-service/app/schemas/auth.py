from pydantic import BaseModel, EmailStr, Field

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)

class UserLogin(BaseModel):
    username: str = Field(...)
    password: str = Field(...)

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int = 1800  # 30 minutes in seconds

class TokenRefreshRequest(BaseModel):
    refresh_token: str

class UserMe(BaseModel):
    id: int
    username: str
    email: EmailStr

    class Config:
        from_attributes = True
