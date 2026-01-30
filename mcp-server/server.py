from mcp.server.fastmcp import FastMCP
import asyncio
import os
from dotenv import load_dotenv

load_dotenv() # Load E2B_API_KEY from .env

# Initialize the MCP Server
mcp = FastMCP("LeetCode Verification Server")

from e2b_code_interpreter import Sandbox

@mcp.tool()
async def verify_solution(code: str, test_input: str) -> str:
    """
    Executes the user's solution code against a specific test input.
    """
    return verify_solution_logic(code, test_input)

def verify_solution_logic(code: str, test_input: str) -> str:
    # 1. Initialize E2B Sandbox (Synchronous context manager)
    with Sandbox.create() as sandbox:
        # 2. Prepare the verification script
        full_script = f"""
class Solution:
{code}

# Test Harness
try:
    sol = Solution()
    # We use eval to parse the string representation of the input args if needed, 
    # but for this specific LeetCode problem (Reverse Polish Notation), 
    # the input is a list of strings "tokens".
    # We assume 'test_input' comes in as a valid python list string, e.g. "['2', '1', '+', '3', '*']"
    import ast
    try:
        tokens = ast.literal_eval("{test_input}")
    except:
        # Fallback if input is not a literal (e.g. raw string)
        tokens = "{test_input}"
    
    # Make it generic: Try to find the method to call?
    # For now, we hardcode 'evalRPN' based on problem 150, but we should make this dynamic later.
    # To make it dynamic, we inspect the Solution class.
    import inspect
    methods = [m for m in dir(sol) if not m.startswith('__')]
    if methods:
        method_name = methods[0] # Pick the first public method
        method = getattr(sol, method_name)
        result = method(tokens)
        print(f"Result: {{result}}")
    else:
        print("Error: No method found in Solution class")

except Exception as e:
    import traceback
    traceback.print_exc()
"""
        # 3. Run the code inside the isolated VM (Synchronous call)
        execution = sandbox.run_code(full_script)
        
        # 4. Return logs to the AI
        if execution.error:
            return f"Runtime Error: {execution.error.name}: {execution.error.value}\\nTraceback:\\n{execution.logs.stderr}"
        
        return f"Output Logs:\\n{execution.logs.stdout}"

if __name__ == "__main__":
    # Run the server
    mcp.run()
