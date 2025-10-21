#!/bin/bash
# Aborta em caso de erro
set -e

# Garante que o script rode na raiz do projeto
cd "$(dirname "$0")"

# Executa o comando desejado
python3 gen_manifest.py

# Mantém o terminal aberto após execução (útil pra ver mensagens)
echo ""
echo "Execução concluída. Pressione ENTER para fechar."
read

