from fastapi import FastAPI

app = FastAPI(title="Strategy Engine Service")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "strategy-engine"}

@app.get("/")
async def root():
    return {"message": "Welcome to Strategy Engine"}
