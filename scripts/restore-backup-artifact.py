#!/usr/bin/env python3
"""Restore a synthetic/local CAREER_COMPASS_RECOVERABLE_BACKUP_V2 artifact."""

import argparse
import glob
import json
import os
import re
import sqlite3


IDENTIFIER = re.compile(r"^[a-z][a-z0-9_]{0,63}$")


def restore(artifact_path: str, output_path: str) -> None:
    if os.path.exists(output_path):
        raise ValueError("output database already exists")
    with open(artifact_path, encoding="utf-8") as source:
        artifact = json.load(source)
    if artifact.get("format") != "CAREER_COMPASS_RECOVERABLE_BACKUP_V2":
        raise ValueError("unsupported backup artifact")
    if artifact.get("schemaVersion") != "0013":
        raise ValueError("unsupported schema version")
    tables = artifact.get("tables")
    counts = artifact.get("counts")
    if not isinstance(tables, dict) or not isinstance(counts, dict):
        raise ValueError("backup rows or counts are missing")
    if any(not IDENTIFIER.fullmatch(name) for name in tables):
        raise ValueError("invalid table identifier")

    database = sqlite3.connect(output_path)
    try:
        database.execute("PRAGMA foreign_keys=ON")
        for migration in sorted(glob.glob("migrations/*.sql")):
            database.executescript(open(migration, encoding="utf-8").read())
        expected = {
            row[0]
            for row in database.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        if set(tables) != expected or set(counts) != expected:
            raise ValueError("artifact does not cover every application table")
        for table, rows in tables.items():
            if not isinstance(rows, list) or counts[table] != len(rows):
                raise ValueError(f"row count mismatch: {table}")

        triggers = list(
            database.execute(
                "SELECT name,sql FROM sqlite_master WHERE type='trigger' ORDER BY name"
            )
        )
        database.execute("PRAGMA foreign_keys=OFF")
        with database:
            for name, _ in triggers:
                database.execute(f'DROP TRIGGER "{name}"')
            for table in tables:
                database.execute(f'DELETE FROM "{table}"')
            for table, rows in tables.items():
                for row in rows:
                    if not isinstance(row, dict) or not row:
                        raise ValueError(f"invalid row: {table}")
                    columns = list(row)
                    if any(not IDENTIFIER.fullmatch(column) for column in columns):
                        raise ValueError(f"invalid column: {table}")
                    names = ",".join(f'"{column}"' for column in columns)
                    marks = ",".join("?" for _ in columns)
                    database.execute(
                        f'INSERT INTO "{table}"({names}) VALUES({marks})',
                        [row[column] for column in columns],
                    )
            for _, sql in triggers:
                database.execute(sql)
        database.execute("PRAGMA foreign_keys=ON")
        violations = list(database.execute("PRAGMA foreign_key_check"))
        if violations:
            raise ValueError("restored database failed foreign key validation")
        for table, expected_count in counts.items():
            actual = database.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
            if actual != expected_count:
                raise ValueError(f"restored count mismatch: {table}")
    except Exception:
        database.close()
        os.unlink(output_path)
        raise
    database.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact")
    parser.add_argument("output")
    args = parser.parse_args()
    restore(args.artifact, args.output)


if __name__ == "__main__":
    main()
