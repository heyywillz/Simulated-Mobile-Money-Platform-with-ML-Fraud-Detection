from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.user import user

app = FastAPI(title="Fraud Detection ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
@app.get("/status")
def health_check():
    return {"status": "healthy", "service": "Fraud Detection ML API", "version": "1.0.0"}

app.include_router(user)