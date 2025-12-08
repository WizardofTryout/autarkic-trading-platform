"""
Cleanup Tasks for Agent Logs.

This module contains Celery tasks for cleaning up old agent logs
to prevent database bloat. Logs older than 15 days are deleted hourly.
"""

import logging
from datetime import datetime, timedelta

from app.core.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.cleanup_logs.cleanup_agent_logs")
def cleanup_agent_logs():
    """
    Delete agent logs older than 15 days.
    
    This task runs hourly via Celery Beat and removes old entries
    from the agent_logs table to prevent database bloat.
    
    Returns:
        dict: Summary of cleanup operation
    """
    from sqlalchemy import create_engine, text
    import os
    
    # Build database URL from environment
    db_host = os.getenv("POSTGRES_SERVER", "ledger-db")
    db_name = os.getenv("POSTGRES_DB", "trading_db")
    db_user = os.getenv("POSTGRES_USER", "postgres")
    
    # Read password from Docker secret
    try:
        with open("/run/secrets/db_password", "r") as f:
            db_password = f.read().strip()
    except FileNotFoundError:
        db_password = os.getenv("POSTGRES_PASSWORD", "postgres")
    
    database_url = f"postgresql://{db_user}:{db_password}@{db_host}/{db_name}"
    
    try:
        engine = create_engine(database_url)
        
        cutoff_date = datetime.utcnow() - timedelta(days=15)
        
        with engine.connect() as conn:
            # Check if table exists first
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'agent_logs'
                )
            """))
            table_exists = result.scalar()
            
            if not table_exists:
                logger.info("agent_logs table does not exist yet. Skipping cleanup.")
                return {"status": "skipped", "reason": "table_does_not_exist"}
            
            # Delete old logs
            result = conn.execute(
                text("DELETE FROM agent_logs WHERE timestamp < :cutoff"),
                {"cutoff": cutoff_date}
            )
            conn.commit()
            
            deleted_count = result.rowcount
            logger.info(f"Cleaned up {deleted_count} old agent logs")
            
            return {
                "status": "success",
                "deleted_count": deleted_count,
                "cutoff_date": cutoff_date.isoformat()
            }
            
    except Exception as e:
        logger.error(f"Failed to cleanup agent logs: {e}")
        return {"status": "error", "error": str(e)}
