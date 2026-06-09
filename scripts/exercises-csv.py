#!/usr/bin/env python3
"""Export exercises.json to CSV for editing, then import back."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / 'src' / 'data' / 'exercises.json'
DEFAULT_CSV = ROOT / 'src' / 'data' / 'exercises.csv'

import sys

sys.path.insert(0, str(ROOT / 'scripts'))
from muscle_groups import MUSCLE_GROUPS, normalize_muscle_groups

PHOTO_SEP = ' | '
LIST_SEP = ' + '

COLUMNS = [
    'id',
    'name',
    'muscleGroups',
    'difficulties',
    'exerciseType',
    'defaultSets',
    'defaultReps',
    'defaultDuration',
    'durationUnit',
    'defaultWeight',
    'startingWeightNote',
    'tutorialVideoUrl',
    'instructionPhotos',
    'thumbnailPhotoIndex',
    'instructions',
]

DIFFICULTIES = {'beginner', 'intermediate', 'advanced'}
DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced']
DIFFICULTY_SHORT = {
    'beginner': 'Beg',
    'intermediate': 'Int',
    'advanced': 'Adv',
}
DIFFICULTY_ALIASES = {
    'beg': 'beginner',
    'beginner': 'beginner',
    'int': 'intermediate',
    'intermediate': 'intermediate',
    'adv': 'advanced',
    'advanced': 'advanced',
}


def normalize_difficulty_range(levels: list[str]) -> list[str]:
    indices = sorted(
        {
            DIFFICULTY_ORDER.index(level)
            for level in levels
            if level in DIFFICULTY_ORDER
        }
    )
    if not indices:
        return ['intermediate']
    return DIFFICULTY_ORDER[indices[0] : indices[-1] + 1]


def format_difficulties_cell(levels: list[str]) -> str:
    normalized = normalize_difficulty_range(levels)
    if len(normalized) == 1:
        return DIFFICULTY_SHORT[normalized[0]]
    return f'{DIFFICULTY_SHORT[normalized[0]]}+'


def parse_difficulty_token(token: str) -> str:
    value = token.strip().lower()
    if value.endswith('+'):
        value = value[:-1].strip()
    return DIFFICULTY_ALIASES.get(value, value)


def parse_difficulties_cell(value: str) -> list[str]:
    value = value.strip()
    if not value:
        return ['intermediate']
    if value.endswith('+'):
        base = parse_difficulty_token(value)
        if base not in DIFFICULTY_ORDER:
            raise ValueError(f'Invalid difficulty range {value!r}')
        start = DIFFICULTY_ORDER.index(base)
        return DIFFICULTY_ORDER[start:]
    levels = [parse_difficulty_token(part) for part in parse_list_cell(value)]
    return normalize_difficulty_range(levels)

EXERCISE_TYPES = {
    'squat',
    'hinge',
    'horizontal-push',
    'horizontal-pull',
    'vertical-push',
    'vertical-pull',
    'accessory',
    'core',
    'cardio',
    'stretch',
    'joint-mobility',
    'roller-massage',
}


def load_json() -> list[dict]:
    return json.loads(JSON_PATH.read_text(encoding='utf-8'))


def list_to_cell(values: list[str]) -> str:
    return LIST_SEP.join(values)


def parse_list_cell(value: str) -> list[str]:
    return [part.strip() for part in value.split('+') if part.strip()]


def muscle_groups_from_exercise(ex: dict) -> list[str]:
    groups = ex.get('muscleGroups')
    if isinstance(groups, list) and groups:
        return normalize_muscle_groups(
            [str(group).strip() for group in groups if str(group).strip()]
        )
    legacy = ex.get('muscleGroup')
    if legacy:
        return normalize_muscle_groups([str(legacy).strip()])
    return ['Other']


def difficulties_from_exercise(ex: dict) -> list[str]:
    levels = ex.get('difficulties')
    if isinstance(levels, list) and levels:
        return normalize_difficulty_range(
            [str(level).strip().lower() for level in levels if str(level).strip()]
        )
    legacy = ex.get('difficulty')
    if legacy:
        return normalize_difficulty_range([str(legacy).strip().lower()])
    return ['intermediate']


def exercise_to_row(ex: dict) -> dict[str, str]:
    photos = ex.get('instructionPhotos') or []
    return {
        'id': ex.get('id', ''),
        'name': ex.get('name', ''),
        'muscleGroups': list_to_cell(muscle_groups_from_exercise(ex)),
        'difficulties': format_difficulties_cell(difficulties_from_exercise(ex)),
        'exerciseType': ex.get('exerciseType', ''),
        'defaultSets': '' if ex.get('defaultSets') is None else str(ex['defaultSets']),
        'defaultReps': '' if ex.get('defaultReps') is None else str(ex['defaultReps']),
        'defaultDuration': ''
        if ex.get('defaultDuration') is None
        else str(ex['defaultDuration']),
        'durationUnit': ex.get('durationUnit', '') or '',
        'defaultWeight': ''
        if ex.get('defaultWeight') is None
        else str(ex['defaultWeight']),
        'startingWeightNote': ex.get('startingWeightNote', '') or '',
        'tutorialVideoUrl': ex.get('tutorialVideoUrl', '') or '',
        'instructionPhotos': PHOTO_SEP.join(photos),
        'thumbnailPhotoIndex': ''
        if ex.get('thumbnailPhotoIndex') is None
        else str(ex['thumbnailPhotoIndex']),
        'instructions': ex.get('instructions', '') or '',
    }


def parse_optional_float(value: str) -> float | None:
    value = value.strip()
    if not value:
        return None
    return float(value)


def parse_optional_int(value: str) -> int | None:
    value = value.strip()
    if not value:
        return None
    return int(float(value))


def parse_optional_reps(value: str) -> int | str | None:
    value = value.strip()
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return value


def row_to_exercise(row: dict[str, str]) -> dict:
    muscle_groups = normalize_muscle_groups(
        parse_list_cell(row.get('muscleGroups', '') or row.get('muscleGroup', ''))
    )
    if not muscle_groups:
        raise ValueError(f"Missing muscle groups for id {row['id']!r}")
    for muscle_group in muscle_groups:
        if muscle_group not in MUSCLE_GROUPS:
            raise ValueError(
                f"Invalid muscle group {muscle_group!r} for id {row['id']!r}"
            )

    try:
        difficulties = parse_difficulties_cell(
            row.get('difficulties', '') or row.get('difficulty', 'intermediate')
        )
    except ValueError as exc:
        raise ValueError(f"Invalid difficulties for id {row['id']!r}: {exc}") from exc
    for difficulty in difficulties:
        if difficulty not in DIFFICULTIES:
            raise ValueError(
                f"Invalid difficulty {difficulty!r} for id {row['id']!r}"
            )

    ex: dict = {
        'id': row['id'].strip(),
        'name': row['name'].strip(),
        'muscleGroups': muscle_groups,
        'difficulties': difficulties,
        'instructions': row['instructions'],
        'exerciseType': row['exerciseType'].strip(),
        'defaultSets': parse_optional_int(row['defaultSets']) or 3,
    }

    exercise_type = ex['exerciseType']
    if exercise_type not in EXERCISE_TYPES:
        raise ValueError(f"Invalid exerciseType {exercise_type!r} for id {ex['id']!r}")

    default_reps = parse_optional_reps(row['defaultReps'])
    default_duration = parse_optional_float(row['defaultDuration'])
    duration_unit = row['durationUnit'].strip() or None
    default_weight = parse_optional_float(row['defaultWeight'])

    if default_reps is not None:
        ex['defaultReps'] = default_reps
    if default_duration is not None:
        ex['defaultDuration'] = default_duration
    if duration_unit:
        ex['durationUnit'] = duration_unit
    if default_weight is not None:
        ex['defaultWeight'] = default_weight

    note = row['startingWeightNote'].strip()
    if note:
        ex['startingWeightNote'] = note

    video = row['tutorialVideoUrl'].strip()
    if video:
        ex['tutorialVideoUrl'] = video

    photos_raw = row['instructionPhotos'].strip()
    if photos_raw:
        photos = [p.strip() for p in photos_raw.split('|') if p.strip()]
        if photos:
            ex['instructionPhotos'] = photos
            thumb = parse_optional_int(row['thumbnailPhotoIndex'])
            if thumb is not None:
                ex['thumbnailPhotoIndex'] = thumb

    return ex


def export_csv(path: Path) -> None:
    exercises = load_json()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(
            f,
            fieldnames=COLUMNS,
            quoting=csv.QUOTE_MINIMAL,
            lineterminator='\n',
        )
        writer.writeheader()
        for ex in exercises:
            writer.writerow(exercise_to_row(ex))
    print(f'Exported {len(exercises)} exercises to {path}')


def import_csv(path: Path) -> None:
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        missing = set(COLUMNS) - set(reader.fieldnames or [])
        legacy_ok = {'muscleGroup', 'difficulty'}
        if missing and not missing.issubset(legacy_ok):
            raise SystemExit(f'Missing CSV columns: {", ".join(sorted(missing))}')

        exercises = [row_to_exercise(row) for row in reader]

    ids = [ex['id'] for ex in exercises]
    if len(ids) != len(set(ids)):
        raise SystemExit('Duplicate exercise ids found in CSV')

    JSON_PATH.write_text(
        json.dumps(exercises, indent=2, ensure_ascii=False) + '\n',
        encoding='utf-8',
    )
    print(f'Wrote {len(exercises)} exercises to {JSON_PATH}')


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)

    export_parser = sub.add_parser('export', help='Write exercises.json to CSV')
    export_parser.add_argument(
        '-o',
        '--output',
        type=Path,
        default=DEFAULT_CSV,
        help=f'Output CSV path (default: {DEFAULT_CSV})',
    )

    import_parser = sub.add_parser('import', help='Update exercises.json from CSV')
    import_parser.add_argument(
        'csv',
        type=Path,
        nargs='?',
        default=DEFAULT_CSV,
        help=f'Edited CSV path (default: {DEFAULT_CSV})',
    )

    args = parser.parse_args()
    if args.command == 'export':
        export_csv(args.output)
    else:
        import_csv(args.csv)


if __name__ == '__main__':
    main()
