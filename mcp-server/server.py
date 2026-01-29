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
    
    Args:
        code (str): The full Python code of the solution class.
        test_input (str): The input arguments for the function (e.g., "['4', '13', '5', '/', '+']").
        
    Returns:
        str: The execution logs, stdout, and result.
    """
    
    # 1. Initialize E2B Sandbox (Synchronous context manager)
    # We use the synchronous API inside the async tool wrapper, which is acceptable for this use case.
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
    tokens = ast.literal_eval("{test_input}")
    
    result = sol.evalRPN(tokens)
    print(f"Result: {{result}}")
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
