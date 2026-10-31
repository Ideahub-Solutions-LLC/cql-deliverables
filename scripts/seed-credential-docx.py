"""Load local DSI accounts from a private credential DOCX without retaining a plaintext copy."""

import json
import subprocess
import sys
import os
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REMOTE = "--remote" in sys.argv
SOURCE_ARG = next((arg for arg in sys.argv[1:] if not arg.startswith("--")), "notes/credential.docx")
SOURCE = (ROOT / SOURCE_ARG).resolve()
PRIVATE_DIR = ROOT / "notes"
NAMESPACE = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def cell_text(cell):
    return "".join(node.text or "" for node in cell.findall(".//w:t", NAMESPACE)).strip()


def main():
    if not SOURCE.is_file():
        raise SystemExit(f"Credential document not found: {SOURCE}")
    with zipfile.ZipFile(SOURCE) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
    tables = document.findall(".//w:tbl", NAMESPACE)
    if not tables:
        raise SystemExit("Credential document has no account table.")
    rows = tables[0].findall("./w:tr", NAMESPACE)
    if not rows or [cell_text(cell).lower() for cell in rows[0].findall("./w:tc", NAMESPACE)] != ["username", "password", "access"]:
        raise SystemExit("Credential table does not match the expected username/password/access format.")

    introductory_text = " ".join(node.text or "" for node in document.findall(".//w:p//w:t", NAMESPACE)).lower()
    grants_ludwig_full_control = "ludwig" in introductory_text and "full control" in introductory_text
    plan = json.loads((ROOT / "app/data/plan.json").read_text(encoding="utf-8"))
    person_ids = {person["id"] for person in plan.get("people", [])}
    access_roles = {
        "admin": "admin",
        "reviewer": "reviewer",
        "staff": "staff",
        "delegated reviewer": "delegated_reviewer",
        "viewer": "viewer",
    }
    accounts = []
    for row in rows[1:]:
        cells = [cell_text(cell) for cell in row.findall("./w:tc", NAMESPACE)]
        if len(cells) != 3:
            continue
        username, password, access = cells
        if not username or not password:
            continue
        role = access_roles.get(access.lower())
        if role is None:
            raise SystemExit(f"Unsupported access role for account {username}.")
        if username.lower() == "ludwig" and grants_ludwig_full_control:
            role = "admin"
        display_name = " ".join(word.capitalize() for word in username.replace("_", " ").split())
        if username.lower() == "reviewer":
            display_name = "Delegated reviewer"
        elif username.lower() == "viewer":
            display_name = "Read-only viewer"
        accounts.append({
            "username": username.lower(),
            "password": password,
            "role": role,
            "displayName": display_name,
            "personId": username.lower() if username.lower() in person_ids else None,
        })
    if not accounts:
        raise SystemExit("Credential document contains no accounts.")

    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)
    descriptor, path = tempfile.mkstemp(prefix=".accounts-import-", suffix=".json", dir=PRIVATE_DIR)
    PRIVATE_JSON = Path(path)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as account_file:
            json.dump(accounts, account_file)
        os.chmod(PRIVATE_JSON, 0o600)
        command = ["node", "scripts/seed-accounts.mjs", str(PRIVATE_JSON.relative_to(ROOT))]
        if REMOTE:
            command.append("--remote")
        subprocess.run(command, cwd=ROOT, check=True)
    finally:
        PRIVATE_JSON.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
