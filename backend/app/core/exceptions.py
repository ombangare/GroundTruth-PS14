class AppException(Exception):
    """Base class for all centralized object-oriented application exceptions."""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code

class EarthEngineError(AppException):
    """Raised when Earth Engine compute fails or is unavailable."""
    def __init__(self, message: str = "Earth Engine service is unavailable or failed to compute."):
        super().__init__(message, status_code=503)

class DatabaseError(AppException):
    """Raised when a database interaction fails."""
    def __init__(self, message: str = "A database error occurred."):
        super().__init__(message, status_code=500)

class NotFoundError(AppException):
    """Raised when a requested resource is not found."""
    def __init__(self, message: str = "Resource not found."):
        super().__init__(message, status_code=404)
