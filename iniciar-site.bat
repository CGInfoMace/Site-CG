@echo off
title Site Oficial CG Info - Servidor & Portal de OS
color 0A
chcp 65001 > nul
cls

echo ===============================================================================
echo            CG INFO - ASSISTÊNCIA TÉCNICA ESPECIALIZADA EM INFORMÁTICA
echo                       SITE & PORTAL DE CONSULTA DE OS
echo ===============================================================================
echo.
echo  [1/2] Verificando dependencias...
if not exist "node_modules" (
    echo Instalando pacotes necessarios...
    call npm.cmd install
)

echo  [2/2] Iniciando Servidor Web do Site CG Info...
echo.
echo  O site abrira automaticamente no seu navegador padrao.
echo  Endereco: http://localhost:3001
echo.
echo  Para fechar o site, basta fechar esta janela.
echo ===============================================================================
echo.

start "" "http://localhost:3001"

node server.js
pause
