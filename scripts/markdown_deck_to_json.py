#!/usr/bin/env python3
"""Convert a simple Markdown card deck into Cornerstone 3 deck JSON."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


CARD_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
DECK_HEADING_RE = re.compile(r"^#\s+(.+?)\s*$")
FIELD_RE = re.compile(r"^(Short|Long|Art|Id):\s*(.*)$", re.IGNORECASE)
VALID_ART = {"sword", "shield", "bow", "winged-shoe"}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "deck"


def parse_markdown(markdown: str, deck_id: str | None, deck_title: str | None) -> dict[str, Any]:
    title = deck_title
    current: dict[str, str] | None = None
    current_field: str | None = None
    cards: list[dict[str, str]] = []

    def finish_card() -> None:
        nonlocal current, current_field
        if current is None:
            return

        card_title = current["title"]
        card_id = current.get("id") or f"{deck_id or slugify(title or 'deck')}-{slugify(card_title)}"
        card = {
            "id": card_id,
            "title": card_title,
            "shortDescription": current.get("short", ""),
            "longDescription": current.get("long", ""),
            "art": current.get("art", ""),
        }
        cards.append(card)
        current = None
        current_field = None

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()

        deck_match = DECK_HEADING_RE.match(line)
        if deck_match and title is None:
            title = deck_match.group(1).strip()
            continue

        card_match = CARD_HEADING_RE.match(line)
        if card_match:
            finish_card()
            current = {"title": card_match.group(1).strip()}
            current_field = None
            continue

        if current is None:
            continue

        field_match = FIELD_RE.match(line)
        if field_match:
            field_name = field_match.group(1).lower()
            field_value = field_match.group(2).strip()
            current[field_name] = field_value
            current_field = field_name if field_name in {"short", "long"} else None
            continue

        if current_field and line:
            current[current_field] = f"{current[current_field]}\n{line.strip()}"

    finish_card()

    if not title:
        raise ValueError("Missing deck title. Add a '# Deck Name' heading or pass --deck-title.")
    if not cards:
        raise ValueError("No cards found. Add cards with '## Card Name' headings.")

    final_deck_id = deck_id or slugify(title)
    for card in cards:
        card["id"] = card["id"] or f"{final_deck_id}-{slugify(card['title'])}"
        art = card["art"]
        if art and art not in VALID_ART:
            valid_values = ", ".join(sorted(VALID_ART))
            raise ValueError(f"Invalid art value '{art}' on '{card['title']}'. Use one of: {valid_values}.")

    return {
        "id": final_deck_id,
        "title": title,
        "cards": cards,
    }


def load_catalog(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"decks": []}
    with path.open("r", encoding="utf-8") as file:
        catalog = json.load(file)
    if not isinstance(catalog.get("decks"), list):
        raise ValueError(f"{path} is not a Cornerstone 3 card catalog.")
    return catalog


def upsert_deck(catalog: dict[str, Any], deck: dict[str, Any]) -> dict[str, Any]:
    decks = catalog["decks"]
    for index, existing_deck in enumerate(decks):
        if existing_deck.get("id") == deck["id"]:
            decks[index] = deck
            return catalog
    decks.append(deck)
    return catalog


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert a Markdown deck into Cornerstone 3 JSON.",
    )
    parser.add_argument("input", type=Path, help="Markdown deck file to convert.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="JSON file to write. Prints to stdout when omitted.",
    )
    parser.add_argument("--deck-id", help="Deck id to use in JSON. Defaults to a slug of the deck title.")
    parser.add_argument("--deck-title", help="Deck title to use in JSON. Defaults to the first # heading.")
    parser.add_argument(
        "--catalog",
        action="store_true",
        help="Write a full { \"decks\": [...] } catalog instead of a single deck object.",
    )
    parser.add_argument(
        "--append-to",
        type=Path,
        help="Add or replace this deck in an existing catalog file, such as packages/game/src/cardCatalog.json.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        markdown = args.input.read_text(encoding="utf-8")
        deck = parse_markdown(markdown, args.deck_id, args.deck_title)
        payload = deck

        if args.append_to:
            payload = upsert_deck(load_catalog(args.append_to), deck)
        elif args.catalog:
            payload = {"decks": [deck]}

        formatted = json.dumps(payload, indent=2) + "\n"
        if args.output:
            args.output.write_text(formatted, encoding="utf-8")
        else:
            print(formatted, end="")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
