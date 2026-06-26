"""
Execution Utilities — shared helpers for all execution scripts.

Usage:
    from utils import load_env, setup_logging

Functions:
    load_env()       — Load .env file from project root
    setup_logging()  — Configure consistent stdout/stderr logging
"""

import os
import sys
import logging
from pathlib import Path


def get_project_root() -> Path:
    """Return the project root directory (parent of execution/)."""
    return Path(__file__).resolve().parent.parent


def load_env() -> None:
    """
    Load environment variables from the project root .env file.
    Falls back gracefully if python-dotenv is not installed.
    """
    env_path = get_project_root() / ".env"
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_path)
    except ImportError:
        # Manual fallback: parse KEY=VALUE lines
        if env_path.exists():
            with open(env_path, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        os.environ.setdefault(key.strip(), value.strip())


def setup_logging(name: str = "execution", level: int = logging.INFO) -> logging.Logger:
    """
    Configure a logger that writes to stdout (info) and stderr (warnings+).
    Returns the configured logger.
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    if not logger.handlers:
        # Info and below → stdout
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setLevel(logging.DEBUG)
        stdout_handler.addFilter(lambda record: record.levelno <= logging.INFO)
        stdout_handler.setFormatter(
            logging.Formatter("[%(levelname)s] %(message)s")
        )

        # Warning and above → stderr
        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setLevel(logging.WARNING)
        stderr_handler.setFormatter(
            logging.Formatter("[%(levelname)s] %(name)s: %(message)s")
        )

        logger.addHandler(stdout_handler)
        logger.addHandler(stderr_handler)

    return logger
