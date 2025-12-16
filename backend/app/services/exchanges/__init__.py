# Exchanges module for multi-exchange support
from .base import ExchangeService
from .bitget_service import BitgetService

__all__ = ["ExchangeService", "BitgetService"]
