import sys
import os

# DIAGNOSTIC MODE
# This script bypasses the main app to check the environment.

def application(environ, start_response):
    status = '200 OK'
    headers = [('Content-type', 'text/plain; charset=utf-8')]
    start_response(status, headers)
    
    output = []
    output.append("=== SISNAV DIAGNOSTIC ===\n\n")
    output.append(f"Python Version: {sys.version}\n")
    output.append(f"Current Directory: {os.getcwd()}\n")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output.append(f"Script Directory: {script_dir}\n")
    
    # 1. Check Path
    if script_dir not in sys.path:
        sys.path.append(script_dir)
        output.append("Added Script Dir to Path.\n")
    
    output.append(f"Sys Path: {sys.path}\n\n")

    # 2. Check Flask
    try:
        import flask
        output.append(f"Flask Installed: Yes ({flask.__version__})\n")
    except ImportError as e:
        output.append(f"CRITICAL: Flask NOT FOUND ({e})\n")
        return [b"".join(s.encode('utf-8') for s in output)]

    # 3. Check Server Import
    try:
        import server
        output.append("Server Module: Import Successful\n")
        if hasattr(server, 'app'):
             output.append("Server App Object: Found\n")
        else:
             output.append("CRITICAL: 'app' object missing in server.py\n")
    except Exception as e:
        output.append(f"CRITICAL: Server Import Failed: {e}\n")
        import traceback
        output.append(traceback.format_exc())

    output.append("\n=== END DIAGNOSTIC ===")
    return [b"".join(s.encode('utf-8') for s in output)]
