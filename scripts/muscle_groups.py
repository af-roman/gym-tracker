"""Shared muscle group taxonomy and inference helpers."""

from __future__ import annotations

import re

MUSCLE_GROUPS = [
    'Chest',
    'Lats',
    'Upper back',
    'Lower back',
    'Delts',
    'Biceps',
    'Triceps',
    'Forearms',
    'Core',
    'Glutes',
    'Quads',
    'Hamstrings',
    'Calves',
    'Full body',
    'Other',
]

MUSCLE_GROUP_ORDER = {group: index for index, group in enumerate(MUSCLE_GROUPS)}

LEGACY_MUSCLE_GROUP_MAP: dict[str, list[str]] = {
    'Arms': ['Biceps', 'Triceps'],
    'Back': ['Lats', 'Upper back'],
    'Chest': ['Chest'],
    'Core': ['Core'],
    'Full body': ['Full body'],
    'Legs': ['Quads', 'Glutes', 'Hamstrings'],
    'Other': ['Other'],
    'Shoulders': ['Delts'],
    'Cardio': ['Full body'],
}

MUSCLE_KEYWORDS: list[tuple[str, list[str]]] = [
    ('Chest', [r'pectoral', r'\bpecs?\b', r'\bchest\b']),
    ('Lats', [r'latissimus', r'\blats?\b']),
    ('Upper back', [r'trapezius', r'\btraps?\b', r'rhomboid', r'upper back']),
    ('Lower back', [r'erector', r'lower back', r'lumbar', r'spinal erector']),
    ('Delts', [r'deltoid', r'\bdelts?\b', r'\bshoulders?\b']),
    ('Biceps', [r'biceps?', r'brachialis']),
    ('Triceps', [r'triceps?']),
    ('Forearms', [r'forearms?', r'brachioradialis', r'\bwrists?\b']),
    (
        'Core',
        [
            r'\bcore\b',
            r'abdominals?',
            r'\babs\b',
            r'obliques?',
            r'mid-?body',
            r'\btrunk\b',
            r'rectus',
        ],
    ),
    ('Glutes', [r'glutes?', r'gluteus', r'buttocks?', r'\bbutt\b']),
    (
        'Quads',
        [
            r'quadriceps',
            r'\bquads?\b',
            r'inner thigh',
            r'outer thigh',
            r'adductor',
            r'abductor',
            r'vastus',
        ],
    ),
    ('Hamstrings', [r'hamstrings?']),
    ('Calves', [r'calves?', r'\bcalf\b', r'gastrocnemius', r'soleus']),
]

GENERIC_MUSCLE_RULES: list[tuple[str, list[str]]] = [
    (r'\barms?\b', ['Biceps', 'Triceps']),
    (r'\blegs?\b', ['Quads', 'Hamstrings']),
    (r'\bback\b', ['Lats', 'Upper back']),
    (r'\bthighs?\b', ['Quads', 'Hamstrings']),
]

EXERCISE_TYPE_HINTS: dict[str, list[str]] = {
    'squat': ['Quads', 'Glutes'],
    'hinge': ['Hamstrings', 'Glutes', 'Lower back'],
    'horizontal-push': ['Chest', 'Triceps'],
    'vertical-push': ['Delts', 'Triceps'],
    'horizontal-pull': ['Lats', 'Upper back'],
    'vertical-pull': ['Lats', 'Biceps'],
    'core': ['Core'],
    'accessory': ['Other'],
    'cardio': ['Full body'],
    'stretch': ['Full body'],
    'joint-mobility': ['Full body'],
    'roller-massage': ['Full body'],
}


def sort_muscle_groups(groups: list[str]) -> list[str]:
    unique = list(dict.fromkeys(group for group in groups if group in MUSCLE_GROUP_ORDER))
    return sorted(unique, key=lambda group: MUSCLE_GROUP_ORDER[group])


def normalize_muscle_groups(groups: list[str]) -> list[str]:
    mapped: list[str] = []
    for group in groups:
        group = group.strip()
        if not group:
            continue
        if group in MUSCLE_GROUP_ORDER:
            if group not in mapped:
                mapped.append(group)
            continue
        legacy = LEGACY_MUSCLE_GROUP_MAP.get(group)
        if legacy:
            for mapped_group in legacy:
                if mapped_group not in mapped:
                    mapped.append(mapped_group)
    return sort_muscle_groups(mapped) if mapped else ['Other']


def muscles_worked_line(instructions: str) -> str:
    for line in instructions.splitlines():
        if line.lower().startswith('muscles worked:'):
            return line.split(':', 1)[1].strip().lower()
    return ''


def match_groups_in_text(text: str) -> list[str]:
    if not text:
        return []

    found: list[str] = []
    for group, patterns in MUSCLE_KEYWORDS:
        for pattern in patterns:
            if re.search(pattern, text):
                found.append(group)
                break

    for pattern, groups in GENERIC_MUSCLE_RULES:
        if re.search(pattern, text):
            for group in groups:
                if group not in found:
                    found.append(group)

    return sort_muscle_groups(found)


def legacy_groups_for_exercise(exercise: dict) -> list[str]:
    groups = exercise.get('muscleGroups')
    if isinstance(groups, list) and groups:
        legacy = [str(group).strip() for group in groups if str(group).strip()]
    else:
        legacy_group = exercise.get('muscleGroup')
        legacy = [str(legacy_group).strip()] if legacy_group else []

    mapped: list[str] = []
    for group in legacy:
        if group in MUSCLE_GROUP_ORDER:
            mapped.append(group)
        elif group in LEGACY_MUSCLE_GROUP_MAP:
            mapped.extend(LEGACY_MUSCLE_GROUP_MAP[group])
        else:
            mapped.append('Other')

    return sort_muscle_groups(mapped)


def infer_muscle_groups(
    muscles: str = '',
    exercise_type: str = '',
    *,
    instructions: str = '',
    name: str = '',
    starting_weight_note: str = '',
    legacy_groups: list[str] | None = None,
) -> list[str]:
    muscles_line = muscles_worked_line(instructions)
    if muscles and not muscles_line:
        muscles_line = muscles.lower()

    found = match_groups_in_text(muscles_line)
    if not found and exercise_type != 'cardio':
        full_text = ' '.join(
            part
            for part in (instructions, name, starting_weight_note, muscles)
            if part
        ).lower()
        found = match_groups_in_text(full_text)

    if not found and exercise_type == 'cardio':
        return ['Full body']

    if found:
        return found

    if legacy_groups:
        mapped = []
        for group in legacy_groups:
            if group in MUSCLE_GROUP_ORDER:
                mapped.append(group)
            elif group in LEGACY_MUSCLE_GROUP_MAP:
                mapped.extend(LEGACY_MUSCLE_GROUP_MAP[group])
        mapped = sort_muscle_groups(mapped)
        if mapped and mapped != ['Full body']:
            return mapped
        if mapped == ['Full body']:
            return mapped

    if exercise_type in EXERCISE_TYPE_HINTS:
        return EXERCISE_TYPE_HINTS[exercise_type]

    return ['Other']


def infer_muscle_groups_for_exercise(exercise: dict) -> list[str]:
    legacy = legacy_groups_for_exercise(exercise)
    return infer_muscle_groups(
        exercise_type=str(exercise.get('exerciseType', '')),
        instructions=str(exercise.get('instructions', '')),
        name=str(exercise.get('name', '')),
        starting_weight_note=str(exercise.get('startingWeightNote', '')),
        legacy_groups=legacy,
    )
