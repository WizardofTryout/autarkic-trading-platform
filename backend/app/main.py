from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from app.core.config import settings
from typing import List
import json
import asyncio
import random

from app.api.api_v1.api import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.include_router(api_router, prefix=settings.API_V1_STR)

from app.services.background_monitor import monitor_positions

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(monitor_positions())

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.get("/health")
async def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}

@app.get("/")
async def root():
    return {"message": "Welcome to Autarkic Trading Agent API"}

@app.websocket("/ws/market")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Simulate receiving data (in real app, this would come from Redis/EventBus)
            # For now, just keep connection open and maybe send heartbeat or mock data
            await asyncio.sleep(1)
            # Mock data push
            price = 45000 + random.uniform(-100, 100)
            data = {
                "type": "ticker",
                "symbol": "BTC/USDT",
                "price": price,
                "timestamp": asyncio.get_event_loop().time()
            }
            await websocket.send_text(json.dumps(data))
            
            # Also listen for client messages if needed
            # data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

