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
except Exception as e:
    import traceback
    error_msg = traceback.format_exc()
    
    # Emergency App to show error
    from flask import Flask
    application = Flask(__name__)
    
    @application.route('/')
    @application.route('/<path:path>')
    def error_handler(path=None):
        return f"<h1>CRITICAL STARTUP ERROR</h1><pre>{error_msg}</pre>", 500
