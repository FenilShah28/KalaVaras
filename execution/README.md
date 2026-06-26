# Execution Scripts

This directory contains deterministic Python scripts — the tools that do the actual work.

## Principles

- **Deterministic**: Same input → same output. No LLM calls inside scripts.
- **Well-commented**: Every script explains what it does, expected inputs, and outputs.
- **Testable**: Scripts can be run independently with test data.
- **Fast**: Optimized for reliability and speed.

## Conventions

- Use `argparse` or `sys.argv` for CLI arguments when applicable.
- Load secrets from `.env` via `python-dotenv` or `os.environ`.
- Write logs to stdout/stderr, not to files (let the orchestrator handle logging).
- Return non-zero exit codes on failure.

## Naming Convention

Use lowercase with underscores: `scrape_single_site.py`, `process_csv.py`, `upload_to_sheets.py`
