<?php
// ARQUIVO DE DIAGNÓSTICO (PHP)
// Objetivo: Testar o ambiente Python "de fora", já que o Passenger/CGI estão falhando.

// 1. Definição do Caminho do Python (Copiado do .htaccess)
$python_path = "/home/c62gtwye66po/virtualenv/sisnav_app/3.9/bin/python";

echo "<h1>SISNAV - Diagnostico via PHP</h1>";

// 2. Verificar se o arquivo do Python existe
if (file_exists($python_path)) {
    echo "<p style='color:green'>[OK] Python Binary encontrado em: $python_path</p>";
} else {
    echo "<p style='color:red'>[ERRO] Python Binary NAO encontrado!</p>";
    echo "<p>Isso explica o Erro 500. O caminho no .htaccess esta errado ou a virtualenv foi deletada.</p>";
    exit;
}

// 3. Teste de Versão
echo "<h3>Teste 1: Versao do Python</h3>";
$output = shell_exec("$python_path --version 2>&1");
echo "<pre>$output</pre>";

// 4. Teste de Importação Flask
echo "<h3>Teste 2: Verificar Flask</h3>";
$cmd = "$python_path -c \"import flask; print('Flask Instalado: ' + flask.__version__)\" 2>&1";
$output_flask = shell_exec($cmd);

if (strpos($output_flask, 'Flask Instalado') !== false) {
    echo "<pre style='color:green'>$output_flask</pre>";
} else {
    echo "<pre style='color:red'>FALHA: Flask NAO detectado.</pre>";
    echo "<pre>Erro detalhado: $output_flask</pre>";
    echo "<p><strong>SOLUCAO:</strong> Voce precisa instalar as dependencias.</p>";
    echo "<p>Comando sugerido pro Suporte/Terminal: <code>$python_path -m pip install -r requirements.txt</code></p>";
}

// 5. Teste de Permissao de Pasta (Data)
echo "<h3>Teste 3: Permissoes</h3>";
$data_dir = __DIR__ . '/data';
if (is_writable(__DIR__)) {
    echo "<p>[OK] Pasta raiz tem permissao de escrita.</p>";
} else {
    echo "<p style='color:orange'>[AVISO] Pasta raiz SOMENTE LEITURA.</p>";
}

?>
