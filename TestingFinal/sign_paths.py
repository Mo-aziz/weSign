"""Resolve bundled resource paths for dev, PyInstaller one-file, and one-folder builds."""

from __future__ import annotations

import sys
from pathlib import Path


def resource_base() -> Path:
    if getattr(sys, "frozen", False):
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            return Path(meipass)
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent
