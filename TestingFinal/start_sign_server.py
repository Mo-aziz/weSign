"""Start the local sign-recognition API on port 8001."""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "sign_server:app",
        host="127.0.0.1",
        port=8001,
        reload=False,
        log_level="info",
    )
