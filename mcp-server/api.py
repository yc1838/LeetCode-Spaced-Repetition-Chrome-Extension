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

import requests
import re

class AgentFixer:
    def __init__(self):
        # Default to local Ollama
        self.llm_url = "http://localhost:11434/api/generate"
        self.model = "llama3.1" # Or configurable

    def is_simple_fix(self, code: str) -> bool:
        # Heuristic: If code is < 10 lines, it's simple enough to show
        # Or if the diff is small (harder to calculate without original)
        return len(code.split('\n')) < 15

    def generate_fix(self, code: str, error: str, test_input: str) -> str:
        prompt = f"""
        You are an expert Python coding assistant.
        The user has the following buggy code which failed with an error.
        
        CODE:
        {code}
        
        ERROR:
        {error}
        
        FAILING INPUT:
        {test_input}
        
        Task: Write a CORRECT, WORKING Python solution that fixes this error.
        CRITICAL: 
        1. Return ONLY the python code. 
        2. Do NOT use markdown blocks like ```python.
        3. Do NOT explain.
        4. The code must be a full valid replacement for the user's snippet.
        """
        
        try:
            res = requests.post(self.llm_url, json={
                "model": self.model,
                "prompt": prompt,
                "stream": False
            })
            if res.status_code == 200:
                # Extract code from response
                raw = res.json().get('response', '').strip()
                # Remove markdown if present
                clean = re.sub(r'```python|```', '', raw).strip()
                return clean
        except Exception as e:
            print(f"LLM Generation Failed: {e}")
        return None

    def verify_fix(self, code: str, test_input: str):
        # Run in sandbox
        logs = verify_solution_logic(code, test_input)
        
        # Check for success
        # Heuristic: If logs contain "Runtime Error" or "Traceback", it failed.
        if "Runtime Error" in logs or "Traceback" in logs:
            return False, logs
        
        return True, logs

    def attempt_fix(self, code: str, error: str, test_input: str):
        # 1. Generate
        print("Generating fix...")
        candidate = self.generate_fix(code, error, test_input)
        if not candidate:
            return {"verified": False, "error": "Failed to generate fix"}
        
        # 2. Verify
        print("Verifying fix...")
        print(f"DEBUG: Candidate Code:\n{candidate}")
        success, logs = self.verify_fix(candidate, test_input)
        print(f"DEBUG: Verification Logs:\n{logs}")
        
        if success:
            # 3. Refine Output
            if self.is_simple_fix(candidate):
                return {
                    "verified": True, 
                    "fixed_code": candidate,
                    "explanation": None,
                    "logs": logs
                }
            else:
                return {
                    "verified": True,
                    "fixed_code": None, # Too long to show? Maybe still show it.
                    "explanation": "I generated a complex fix that passes the tests. It involves rewriting the class structure.",
                    "logs": logs
                }
        else:
            return {
                "verified": False,
                "fixed_code": candidate, # Return it anyway for debugging?
                "logs": logs
            }

agent = AgentFixer()

@app.post("/autofix")
def autofix_endpoint(req: VerificationRequest):
    """
    Agentic Endpoint: Generates and Verifies a fix.
    """
    # req.code is the USER's broken code
    # We also need the Error message ideally, but we can infer or run it first.
    # For now, let's assume we run it first to get the error if not provided?
    # Or strict Auto-Fix: User sends "I have this error". 
    # Current VerificationRequest only has code/input.
    # Let's run the BROKEN code first to get the error trace!
    
    print(f"Auto-Fix Request for: {req.test_input}")
    
    # 1. Reproduce the error locally
    initial_logs = verify_solution_logic(req.code, req.test_input)
    
    # Extract error from logs
    # Assume logs format: "Runtime Error: ... \nTraceback: ..."
    error_context = initial_logs
    
    # 2. Agent Loop
    result = agent.attempt_fix(req.code, error_context, req.test_input)
    return result

if __name__ == "__main__":
    import uvicorn
    # Run on port 8000
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
