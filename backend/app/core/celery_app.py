"""
Celery Application Configuration for Autarkic Trading Platform.

This module initializes the Celery app for background task processing,
including scheduled tasks like log cleanup.
"""

import os
from celery import Celery
from celery.schedules import crontab

# Initialize Celery app
celery_app = Celery(
    "autarkic_trading",
    broker=os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0"),
    include=["app.tasks.cleanup_logs", "app.tasks.fleet_tasks", "app.tasks.collect_ohlcv", "app.tasks.collect_ohlcv_bitget", "app.tasks.cleanup_ohlcv"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max per task
)

# Scheduled tasks (Celery Beat)
celery_app.conf.beat_schedule = {
    # Cleanup old agent logs every hour
    "cleanup-old-agent-logs": {
        "task": "app.tasks.cleanup_logs.cleanup_agent_logs",
        "schedule": crontab(minute=0),  # Every hour at minute 0
    },
    # Collect OHLCV data for active symbols every 60 seconds
    "collect-ohlcv-data": {
        "task": "app.tasks.collect_ohlcv.collect_active_symbols",
        "schedule": 60.0,  # Every 60 seconds
    },
    # Cleanup old OHLCV data daily at 3 AM UTC
    "cleanup-ohlcv-data": {
        "task": "app.tasks.cleanup_ohlcv.cleanup_old_candles",
        "schedule": crontab(hour=3, minute=0),  # Daily at 3:00 AM UTC
    },
    # Collect Bitget OHLCV data for LIVE agents every 60 seconds
    "collect-bitget-ohlcv-data": {
        "task": "app.tasks.collect_ohlcv_bitget.collect_bitget_active_symbols",
        "schedule": 60.0,  # Every 60 seconds
    },
}
