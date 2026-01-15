import sys
import os

# CONFIGURAÇÃO DE DEPLOY - SISNAV COSTEIRO
# Adiciona o diretório atual ao path para encontrar o server.py
project_home = os.getcwd()
if project_home not in sys.path:
    sys.path = [project_home] + sys.path

# Importa a aplicação Flask do arquivo server.py
# Importa a aplicação Flask do arquivo server.py
try:
    from server import app as application
except Exception:
    import traceback
    error_msg = traceback.format_exc()
    
    def application(environ, start_response):
        status = '500 Internal Server Error'
        output = f"""
        <html>
        <head><title>Startup Error</title></head>
        <body>
            <h1>CRITICAL STARTUP ERROR</h1>
            <h3>The Python application failed to load.</h3>
            <pre>{error_msg}</pre>
            <hr>
            <p><strong>Debug Info:</strong></p>
            <ul>
                <li>CWD: {os.getcwd()}</li>
                <li>Python Version: {sys.version}</li>
            </ul>
        </body>
        </html>
        """.encode('utf-8')
        
        response_headers = [('Content-type', 'text/html'),
                            ('Content-Length', str(len(output)))]
        start_response(status, response_headers)
        return [output]
