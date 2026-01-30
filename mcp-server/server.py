from e2b_code_interpreter import Sandbox
import ast
import traceback
import sys
from dotenv import load_dotenv

load_dotenv()

def verify_solution_logic(code: str, test_input: str) -> str:
    # 1. Initialize E2B Sandbox (Synchronous context manager)
    with Sandbox.create() as sandbox:
        # 2. Prepare the verification script
        # Safe string injection: repr() ensures we get a valid python string literal
        input_repr = repr(test_input)
        
        full_script = f"""
import ast
import traceback
import sys

# --- User Code ---
{code}
# -----------------

# --- Test Harness ---
try:
    # 1. Parse Input
    # We expect raw_input to be a string that might contain multiple lines (arg1\\narg2...)
    raw_input_str = {input_repr}
    
    # Split by lines to handle multiple arguments (standard LeetCode format)
    lines = [line.strip() for line in raw_input_str.strip().split('\\n') if line.strip()]
    parsed_args = []
    for line in lines:
        try:
            parsed_args.append(ast.literal_eval(line))
        except:
            parsed_args.append(line)
            
    # 2. Dynamic Class Discovery
    # Look for any user-defined class in current scope
    target_cls = None
    if 'Solution' in globals():
        target_cls = Solution
    else:
        for name, obj in list(globals().items()):
            if isinstance(obj, type) and obj.__module__ == '__main__':
                target_cls = obj
                break
    
    if target_cls:
        # 3. Design Pattern Detection
        # Design problems usually have 2 args: [Commands], [Params]
        is_design = False
        if len(parsed_args) == 2 and isinstance(parsed_args[0], list) and isinstance(parsed_args[1], list):
             commands = parsed_args[0]
             params = parsed_args[1]
             # Heuristic: First command is the class name? Or "MyQueue"?
             # Actually LeetCode design input: ["MyQueue", "push"...]
             # If the first command matches the class name or constructor, we treat it as Design.
             if len(commands) > 0 and (commands[0] == target_cls.__name__ or commands[0] == 'MyQueue' or commands[0] == 'MinStack'): # Generic checks
                 is_design = True
                 
        if is_design:
             commands = parsed_args[0]
             params = parsed_args[1]
             
             # Instantiate
             # First command is usually the constructor call
             obj = target_cls() # Assume no-arg constructor for now or check params[0]
             results = [None] 
             
             for i in range(1, len(commands)):
                 cmd = commands[i]
                 args = params[i]
                 
                 if not hasattr(obj, cmd):
                     print(f"Error: Method {{cmd}} not found")
                     results.append(None)
                     continue
                     
                 method = getattr(obj, cmd)
                 # args matches method signature?
                 try:
                     res = method(*args)
                     results.append(res)
                 except TypeError:
                     # Maybe single arg vs varargs mismatch
                     res = method(args)
                     results.append(res)
                     
             print(f"Output: {{results}}")
             
        else:
             # Standard Solution.method()
             sol = target_cls()
             # Find first public method that isn't __init__
             methods = [m for m in dir(sol) if not m.startswith('__')]
             if methods:
                 # Sort to be deterministic? usually just one
                 method_name = methods[0]
                 method = getattr(sol, method_name)
                 
                 # Call with parsed_args
                 # Use unpacking if multiple args
                 try:
                    res = method(*parsed_args)
                 except:
                    # Fallback single arg
                    res = method(parsed_args)
                    
                 print(f"Result: {{res}}")
             else:
                 print("Error: No public methods found in Solution.")

    else:
        # No class found? Maybe global function?
        print("Error: No valid Solution class found.")

except Exception:
    traceback.print_exc()
"""
        # 3. Run the code inside the isolated VM
        execution = sandbox.run_code(full_script)
        
        if execution.error:
            return f"Runtime Error: {execution.error.name}: {execution.error.value}\\nTraceback:\\n{execution.logs.stderr}"
        
        return f"Output Logs:\\n{execution.logs.stdout}"
