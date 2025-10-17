#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera / atualiza o manifesto data/index.json para a vitrine somente-leitura.
POR QUÊ ASSIM:
- KISS: sem dependências externas.
- SRP: um script com uma responsabilidade: gerar o manifesto.
- DRY: lógica de ordenação e coleta centralizadas.
- Validação de entrada: JSON é sempre não-confiável → tratamos erros e seguimos adiante.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gera data/index.json a partir dos arquivos .json (um por café)."
    )
    parser.add_argument(
        "--data",
        default="data",
        help="Caminho da pasta de dados (onde ficam os JSONs). Padrão: ./data",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Caminho do manifesto de saída. Padrão: <data>/index.json",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Falha (exit 1) se houver algum JSON inválido.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Não escreve arquivo; apenas mostra o manifesto gerado.",
    )
    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="Indentação do JSON gerado. Padrão: 2",
    )
    return parser.parse_args()


def iso_now() -> str:
    # Registro de quando o manifesto foi gerado, em UTC (claridade > localtime)
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def parse_date_safe(s: str) -> Optional[dt.datetime]:
    # Aceita YYYY-MM-DD (nos seus arquivos de café)
    try:
        return dt.datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=dt.timezone.utc)
    except Exception:
        return None


def load_json(path: Path) -> Optional[Dict[str, Any]]:
    try:
        with path.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[ERRO] Falha ao ler {path.name}: {e}", file=sys.stderr)
        return None


def score_recencia(obj: Dict[str, Any], file_path: Path) -> float:
    """
    Critério de ordenação (maior primeiro):
    1) _ts (se existir e for número)
    2) dataTorra (YYYY-MM-DD)
    3) mtime do arquivo
    Retorna um timestamp (epoch seconds).
    """
    ts = obj.get("_ts")
    if isinstance(ts, (int, float)):
        return float(ts)

    d = obj.get("dataTorra")
    if isinstance(d, str):
        d_parsed = parse_date_safe(d)
        if d_parsed:
            return d_parsed.timestamp()

    return file_path.stat().st_mtime


def validate_entry(obj: Dict[str, Any], filename: str) -> List[str]:
    """
    Validações essenciais (não exaustivas):
    - nome: obrigatório, >=2 chars
    - avaliacoes: lista; se houver, cada item precisa de metodo + nota (1..5)
    """
    erros: List[str] = []

    nome = obj.get("nome", "")
    if not isinstance(nome, str) or len(nome.strip()) < 2:
        erros.append("campo 'nome' obrigatório (>=2 caracteres).")

    avals = obj.get("avaliacoes", [])
    if avals is None:
        avals = []
    if not isinstance(avals, list):
        erros.append("campo 'avaliacoes' deve ser lista (pode ser vazia).")
    else:
        for i, m in enumerate(avals, start=1):
            metodo = (
                (m.get("metodo") if isinstance(m, dict) else None)
                if isinstance(m, dict)
                else None
            )
            nota = (
                (m.get("nota") if isinstance(m, dict) else None)
                if isinstance(m, dict)
                else None
            )
            if not metodo or not isinstance(metodo, str) or not metodo.strip():
                erros.append(f"avaliação #{i}: 'metodo' é obrigatório.")
            if not isinstance(nota, (int, float)) or not (1 <= int(nota) <= 5):
                erros.append(f"avaliação #{i}: 'nota' deve ser 1..5.")

    return erros


def collect_entries(data_dir: Path) -> Tuple[List[Tuple[str, float]], List[str]]:
    """
    Retorna (lista_de_entradas, lista_de_erros)
    - lista_de_entradas: [(href, score), ...]
    - href é o nome do arquivo relativo à pasta data (ex.: 'brasil-caparao.json')
    """
    entries: List[Tuple[str, float]] = []
    erros: List[str] = []

    for path in sorted(data_dir.glob("*.json")):
        if path.name.lower() == "index.json":
            continue

        obj = load_json(path)
        if obj is None:
            erros.append(f"{path.name}: JSON inválido ou ilegível.")
            continue

        v = validate_entry(obj, path.name)
        if v:
            msg = f"{path.name}: " + "; ".join(v)
            print(f"[AVISO] {msg}", file=sys.stderr)
            erros.append(msg)

        score = score_recencia(obj, path)
        entries.append((path.name, score))

    # Ordena por score desc (mais recente primeiro)
    entries.sort(key=lambda t: t[1], reverse=True)
    return entries, erros


def build_manifest(entries: List[Tuple[str, float]]) -> Dict[str, Any]:
    return {
        "version": 1,
        "generated_at": iso_now(),
        "cafes": [href for href, _ in entries],
    }


def main() -> int:
    args = parse_args()
    data_dir = Path(args.data).resolve()
    out_path = Path(args.output).resolve() if args.output else (data_dir / "index.json")

    if not data_dir.exists() or not data_dir.is_dir():
        print(f"[ERRO] Pasta de dados não encontrada: {data_dir}", file=sys.stderr)
        return 2

    entries, erros = collect_entries(data_dir)
    manifest = build_manifest(entries)

    if args.dry_run:
        print(json.dumps(manifest, ensure_ascii=False, indent=args.indent))
        # Em dry-run, em modo estrito, ainda assim sinalizamos erro via exit code.
        return 1 if (args.strict and erros) else 0

    try:
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=args.indent)
            f.write("\n")
    except Exception as e:
        print(f"[ERRO] Falha ao escrever manifesto: {e}", file=sys.stderr)
        return 3

    if erros:
        # Em modo estrito, tratamos avisos como erro “hard”
        if args.strict:
            print(
                f"[ERRO] Manifesto escrito em {out_path}, mas há JSONs problemáticos (use --dry-run para ver).",
                file=sys.stderr,
            )
            return 1
        else:
            print(
                f"[AVISO] Manifesto escrito em {out_path}, mas houve {len(erros)} aviso(s).",
                file=sys.stderr,
            )

    print(f"[OK] Manifesto atualizado: {out_path} ({len(entries)} café(s))")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
