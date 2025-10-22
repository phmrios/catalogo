#!/bin/bash
# Aborta em caso de erro
set -e

# Garante que o script rode na raiz do projeto
cd "$(dirname "$0")"

# Executa o comando desejado
git add . && git commit -m ''atualizando'' && git push origin main

# Mantém o terminal aberto após execução (útil pra ver mensagens)
echo ""
echo "Execução concluída. Pressione ENTER para fechar."
read

