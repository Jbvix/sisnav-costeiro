#!/home/c62gtwye66po/virtualenv/sisnav_app/3.9/bin/python
# OBS: O caminho acima (shebang) foi copiado do seu .htaccess (PassengerPython).
# Se não funcionar, tente mudar a primeira linha para: #!/usr/bin/python3
# ou #!/usr/bin/env python

import cgitb
cgitb.enable()

print("Content-Type: text/html\n")
print("<html><body>")
print("<h1>Teste CGI Python</h1>")
print("<p>Se voce esta vendo isso, o Python esta funcionando!</p>")

import sys
import os

print("<h2>Detalhes do Ambiente:</h2>")
print(f"<p><strong>Versao Python:</strong> {sys.version}</p>")
print(f"<p><strong>CWD:</strong> {os.getcwd()}</p>")

try:
    import flask
    print(f"<p style='color:green'><strong>Flask Detectado:</strong> {flask.__version__}</p>")
except ImportError:
    print("<p style='color:red'><strong>ERRO: Flask NAO encontrado!</strong></p>")

print("</body></html>")
