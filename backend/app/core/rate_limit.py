from slowapi import Limiter
from slowapi.util import get_remote_address

# Global rate limiter initialized to track requests per IP address
limiter = Limiter(key_func=get_remote_address)
