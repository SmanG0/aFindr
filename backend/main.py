from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv(override=True)

app = FastAPI(title="Repla Trading API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.data import router as data_router
from routers.chat import router as chat_router
from routers.news import router as news_router

app.include_router(data_router)
app.include_router(chat_router)
app.include_router(news_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
