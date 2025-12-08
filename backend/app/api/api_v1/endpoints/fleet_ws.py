"""
Fleet WebSocket Stream - Real-time updates for trading agents.

This WebSocket endpoint provides live updates for:
- Agent status changes
- Log entries with visual snapshots (Ghost Lines)
- Trade proposals and executions
"""

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

from app.core import security
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class FleetConnectionManager:
    """Manages WebSocket connections for fleet updates."""
    
    def __init__(self):
        # Map of user_id -> set of active connections
        self.active_connections: dict[str, Set[WebSocket]] = {}
        self._redis_task = None
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)
        logger.info(f"Fleet WebSocket connected for user {user_id}")
        
        # Start Redis listener if not running
        if self._redis_task is None:
            self._redis_task = asyncio.create_task(self._listen_to_redis())
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection."""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        logger.info(f"Fleet WebSocket disconnected for user {user_id}")
    
    async def broadcast_to_user(self, user_id: str, message: dict):
        """Send a message to all connections for a specific user."""
        if user_id not in self.active_connections:
            return
        
        message_json = json.dumps(message)
        disconnected = set()
        
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(message_json)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                disconnected.add(websocket)
        
        # Clean up disconnected sockets
        for ws in disconnected:
            self.active_connections[user_id].discard(ws)
    
    async def _listen_to_redis(self):
        """Subscribe to Redis channel and broadcast updates."""
        import redis.asyncio as redis_lib
        import os
        
        redis_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
        
        try:
            redis = redis_lib.from_url(redis_url)
            pubsub = redis.pubsub()
            await pubsub.subscribe("fleet_updates")
            
            logger.info("Fleet WebSocket subscribed to Redis channel")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    try:
                        data = json.loads(message["data"])
                        
                        # Get user_id from the message if available
                        # For now, we need to look up which user owns this agent
                        # This is a simplified approach - in production, include user_id in message
                        agent_id = data.get("agent_id")
                        
                        # Broadcast to all connected users (simplified)
                        # In production, filter by user ownership
                        for user_id in list(self.active_connections.keys()):
                            await self.broadcast_to_user(user_id, data)
                            
                    except json.JSONDecodeError:
                        logger.warning("Invalid JSON in Redis message")
                        
        except Exception as e:
            logger.error(f"Redis subscription error: {e}")
            self._redis_task = None


# Global connection manager
fleet_manager = FleetConnectionManager()


async def get_user_from_token(token: str) -> str:
    """Validate JWT token and extract user email/id."""
    try:
        payload = jwt.decode(
            token,
            security.SECRET_KEY,
            algorithms=[security.ALGORITHM]
        )
        user_email = payload.get("sub")
        if user_email is None:
            raise HTTPException(status_code=403, detail="Invalid token")
        return user_email
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid token")


@router.websocket("/stream")
async def fleet_stream(
    websocket: WebSocket,
    token: str = Query(..., description="JWT authentication token"),
):
    """
    WebSocket endpoint for real-time fleet updates.
    
    Connect with: ws://host/api/v1/fleet/ws/stream?token=<jwt_token>
    
    Messages received:
    - {"type": "status", "agent_id": "...", "status": "SCANNING", ...}
    - {"type": "log", "agent_id": "...", "log_text": "...", "visuals": [...], ...}
    - {"type": "proposal", "agent_id": "...", "proposal": {...}, ...}
    - {"type": "trade", "agent_id": "...", "trade": {...}, ...}
    """
    # Authenticate via token query param
    try:
        user_email = await get_user_from_token(token)
    except HTTPException:
        await websocket.close(code=4001, reason="Authentication failed")
        return
    
    await fleet_manager.connect(websocket, user_email)
    
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "message": "Fleet stream connected",
            "user": user_email,
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for client messages (heartbeat, commands)
                data = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=30.0
                )
                
                message = json.loads(data)
                
                # Handle heartbeat
                if message.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                
                # Handle other commands if needed
                # e.g., subscribe to specific agent, request current state
                
            except asyncio.TimeoutError:
                # Send heartbeat to keep connection alive
                try:
                    await websocket.send_json({"type": "heartbeat"})
                except:
                    break
                    
    except WebSocketDisconnect:
        logger.info(f"Fleet WebSocket disconnected: {user_email}")
    except Exception as e:
        logger.error(f"Fleet WebSocket error: {e}")
    finally:
        fleet_manager.disconnect(websocket, user_email)
