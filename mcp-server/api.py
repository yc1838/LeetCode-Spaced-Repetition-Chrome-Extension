from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os

# Import the logic from server.py
# This will also run load_dotenv() from server.py
from server import verify_solution_logic

app = FastAPI()

# Enable CORS for Chrome Extension (and localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class VerificationRequest(BaseModel):
    code: str
    test_input: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/verify")
def verify_endpoint(req: VerificationRequest):
    """
    Endpoint for the Chrome Extension to call.
    """
    print(f"Received verification request for input: {req.test_input}")
    result = verify_solution_logic(req.code, req.test_input)
    return {"result": result}

if __name__ == "__main__":
    import uvicorn
    # Run on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
