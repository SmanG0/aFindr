"""Shared rate limiter instance — imported by main.py and all routers.

Centralised here to avoid circular imports between main.py and router modules.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
