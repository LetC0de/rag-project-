from fastapi import HTTPException, status, Request, BackgroundTasks
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta, timezone
from src.utils.settings import settings
from src.user.model import UserModel
from src.user.schema import UserSchema, UserLoginSchema
from sqlalchemy.orm import Session
from pwdlib import PasswordHash
import jwt

password_hash = PasswordHash.recommended()


def get_password_hash(password):
    return password_hash.hash(password)


async def register_user(body: UserSchema, db: Session, bg_task: BackgroundTasks):

    # Normalize email to lowercase
    body.email = body.email.strip().lower()

    is_username_exists = db.query(UserModel).filter(UserModel.username.ilike(body.username)).first()

    if is_username_exists:
        raise HTTPException(status_code=400, detail="Username already exists")

    is_email_exists = db.query(UserModel).filter(UserModel.email == body.email).first()

    if is_email_exists:
        raise HTTPException(status_code=400, detail="Email already exists")

    hashed_password = get_password_hash(body.password)

    new_user = UserModel(
        name=body.name,
        username=body.username,
        password=hashed_password,
        email=body.email,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


def login_user(body: UserLoginSchema, db: Session):

    user = db.query(UserModel).filter(UserModel.username.ilike(body.username)).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if not password_hash.verify(body.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")

    exp_time = datetime.now(timezone.utc) + timedelta(minutes=settings.EXP_TIME)

    user.last_seen = datetime.now(timezone.utc)
    db.commit()

    token = jwt.encode({
        "_id": user.id,
        "exp": exp_time.timestamp()
    }, settings.SECRET_KEY, settings.ALGORITHM)

    return {"token": token}


def is_authenticated(request: Request, db: Session):
    try:
        token = request.headers.get("authorization")

        if not token:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token not found")

        token = token.split(" ")[-1]

        data = jwt.decode(token, settings.SECRET_KEY, settings.ALGORITHM)
        user_id = data.get("_id")

        user = db.query(UserModel).filter(UserModel.id == user_id).first()

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        # Update last_seen so the admin dashboard shows accurate online count
        user.last_seen = datetime.now(timezone.utc)
        db.commit()

        return user
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Token")
