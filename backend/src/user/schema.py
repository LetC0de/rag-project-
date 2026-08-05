from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserSchema(BaseModel):
    name: str
    username: str
    password: str
    email: EmailStr


class UserResponseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str
    email: str


class UserLoginSchema(BaseModel):
    username: str
    password: str
