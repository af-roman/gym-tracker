#!/usr/bin/env python3
"""Import exercises from the public Google Sheet xlsx export."""

from __future__ import annotations

import json
import re
import time
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path

from deep_translator import GoogleTranslator
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = Path('/tmp/gym-sheet.xlsx')
PHOTOS_DIR = ROOT / 'public' / 'exercise-photos'
OUT_JSON = ROOT / 'src' / 'data' / 'exercises.json'
TRANSLATION_CACHE = ROOT / 'scripts' / '.translation-cache.json'
SHEET_ID = '1sFTmZ6Q55SZgv5NhxXLBjTM9cMgNYNNH_G6J85R1YSM'
XLSX_URL = f'https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=xlsx'

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'xdr': 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'rel': 'http://schemas.openxmlformats.org/package/2006/relationships',
}

SHEET_TYPE_OVERRIDES = [
    ('zahrati', 'cardio'),
    ('roller', 'stretch'),
    ('mobilita', 'stretch'),
    ('stabilita stredu', 'core'),
    ('drep', 'squat'),
    ('vypad', 'squat'),
    ('kycelni ohyb', 'hinge'),
    ('horizontalni tah', 'horizontal-pull'),
    ('vertikalni tah', 'vertical-pull'),
    ('horizintalni tlak', 'horizontal-push'),
    ('horizontalni tlak', 'horizontal-push'),
    ('vertikalni tlak', 'vertical-push'),
    ('izolovane cviky lower', 'accessory'),
    ('izolovane cviky upper', 'accessory'),
    ('rotace trupu', 'accessory'),
    ('doplnkove cviky', 'accessory'),
    ('staticky strecink', 'stretch'),
]

TYPE_KEYWORDS = [
    ('cardio', ['zahrati', 'zahrat', 'warm up', 'aerob']),
    ('stretch', ['strecink', 'strečink', 'roller', 'mobilita', 'protazeni', 'protažení']),
    ('core', ['stred tela', 'střed těla', 'stabilita stredu', 'stabilita středu']),
    ('squat', ['drep', 'dřep', 'vypad', 'výpad']),
    ('hinge', ['kycelni ohyb', 'kyčelní ohyb']),
    ('horizontal-pull', ['horizontalni tah', 'horizontalní tah']),
    ('vertical-pull', ['vertikalni tah', 'vertikalní tah']),
    ('horizontal-push', ['horizintalni tlak', 'horizontalni tlak', 'horizontální tlak']),
    ('vertical-push', ['vertikalni tlak', 'vertikalní tlak']),
    ('accessory', ['izolovane', 'izolované', 'doplnkove', 'doplňkové', 'rotace trupu']),
]
DURATION_TYPES = {'cardio', 'stretch'}


def normalize(text: str) -> str:
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower()


def infer_type_from_sheet(name: str) -> str:
    n = normalize(name)
    for needle, exercise_type in SHEET_TYPE_OVERRIDES:
        if needle in n:
            return exercise_type
    for exercise_type, keywords in TYPE_KEYWORDS:
        if any(normalize(k) in n for k in keywords):
            return exercise_type
    return 'accessory'


def slugify(name: str, used: set[str]) -> str:
    base = normalize(name)
    base = re.sub(r'[^a-z0-9]+', '-', base).strip('-') or 'exercise'
    slug = base
    i = 2
    while slug in used:
        slug = f'{base}-{i}'
        i += 1
    used.add(slug)
    return slug


def infer_muscle_group(muscles: str, exercise_type: str) -> str:
    text = normalize(muscles or '')
    if any(k in text for k in ['prs', 'pect']):
        return 'Chest'
    if any(k in text for k in ['zada', 'lat', 'trap', 'rhomb']):
        return 'Back'
    if any(k in text for k in ['ramen', 'delt']):
        return 'Shoulders'
    if any(k in text for k in ['biceps', 'triceps', 'predlok', 'paze']):
        return 'Arms'
    if any(k in text for k in ['stehn', 'hyzd', 'noh', 'lytk', 'kyc', 'hamstring']):
        return 'Legs'
    if any(k in text for k in ['stred', 'brus', 'core', 'brich']):
        return 'Core'
    fallback = {
        'squat': 'Legs',
        'hinge': 'Legs',
        'horizontal-push': 'Chest',
        'vertical-push': 'Shoulders',
        'horizontal-pull': 'Back',
        'vertical-pull': 'Back',
        'core': 'Core',
        'cardio': 'Full body',
        'stretch': 'Full body',
        'accessory': 'Other',
    }
    return fallback.get(exercise_type, 'Other')


def parse_prescription(text: str | None, exercise_type: str) -> dict:
    if not text:
        if exercise_type in DURATION_TYPES:
            return {'defaultSets': 1, 'defaultDuration': 30, 'durationUnit': 'sec'}
        return {'defaultSets': 3, 'defaultReps': 10}

    raw = str(text).strip()
    lower = normalize(raw)

    if exercise_type in DURATION_TYPES or re.search(r'\bmin\b', lower) or 'sekund' in lower or re.search(r'\d+\s*s\b', lower):
        minute = re.search(r'(\d+(?:[.,]\d+)?)\s*[-–]?\s*(\d+(?:[.,]\d+)?)?\s*min', lower)
        if minute:
            value = float(minute.group(1).replace(',', '.'))
            return {'defaultSets': 1, 'defaultDuration': value, 'durationUnit': 'min'}
        seconds = re.search(r'(\d+(?:[.,]\d+)?)\s*[-–]?\s*(\d+(?:[.,]\d+)?)?\s*(?:s|sek)', lower)
        if seconds:
            value = float(seconds.group(1).replace(',', '.'))
            sets = 3
            sets_match = re.search(r'(\d+)\s*[x×]', lower)
            if sets_match:
                sets = int(sets_match.group(1))
            return {'defaultSets': sets, 'defaultDuration': value, 'durationUnit': 'sec'}
        if 'min' in lower:
            return {'defaultSets': 1, 'defaultDuration': 5, 'durationUnit': 'min'}
        return {'defaultSets': 3, 'defaultDuration': 30, 'durationUnit': 'sec'}

    sets_match = re.search(r'(\d+)\s*[x×]', lower)
    sets = int(sets_match.group(1)) if sets_match else 3
    reps_match = re.search(r'(\d+)\s*[-–]\s*(\d+)', lower)
    if reps_match:
        reps = f'{reps_match.group(1)}-{reps_match.group(2)}'
    else:
        reps_match = re.search(r'(\d+)', lower)
        reps = int(reps_match.group(1)) if reps_match else 10
    return {'defaultSets': sets, 'defaultReps': reps}


def col_to_index(col: str) -> int:
    value = 0
    for ch in col:
        value = value * 26 + (ord(ch.upper()) - ord('A') + 1)
    return value - 1


def parse_cell_ref(ref: str) -> tuple[int, int]:
    col = ''.join(ch for ch in ref if ch.isalpha())
    row = int(''.join(ch for ch in ref if ch.isdigit()))
    return row, col_to_index(col)


def load_shared_strings(zf: zipfile.ZipFile) -> list[str]:
    if 'xl/sharedStrings.xml' not in zf.namelist():
        return []
    root = ET.fromstring(zf.read('xl/sharedStrings.xml'))
    strings: list[str] = []
    for si in root.findall('m:si', NS):
        parts = [node.text or '' for node in si.findall('.//m:t', NS)]
        strings.append(''.join(parts))
    return strings


def read_sheet_rows(zf: zipfile.ZipFile, sheet_path: str, shared_strings: list[str]) -> dict[int, list]:
    root = ET.fromstring(zf.read(sheet_path))
    max_col = 0
    rows: dict[int, dict[int, object]] = {}
    for cell in root.findall('.//m:c', NS):
        ref = cell.attrib.get('r')
        if not ref:
            continue
        row_idx, col_idx = parse_cell_ref(ref)
        max_col = max(max_col, col_idx)
        cell_type = cell.attrib.get('t')
        value_el = cell.find('m:v', NS)
        inline = cell.find('m:is', NS)
        value: object = None
        if cell_type == 's' and value_el is not None and value_el.text is not None:
            value = shared_strings[int(value_el.text)]
        elif cell_type == 'inlineStr' and inline is not None:
            value = ''.join(t.text or '' for t in inline.findall('.//m:t', NS))
        elif value_el is not None and value_el.text is not None:
            text = value_el.text
            value = float(text) if re.fullmatch(r'-?\d+(\.\d+)?', text) else text
        if value is not None:
            rows.setdefault(row_idx, {})[col_idx] = value
    dense: dict[int, list] = {}
    for row_idx, cols in rows.items():
        dense[row_idx] = [cols.get(i) for i in range(max_col + 1)]
    return dense


def workbook_sheets(zf: zipfile.ZipFile) -> list[tuple[str, str]]:
    root = ET.fromstring(zf.read('xl/workbook.xml'))
    rels = ET.fromstring(zf.read('xl/_rels/workbook.xml.rels'))
    rel_map = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels.findall('rel:Relationship', NS)}
    sheets: list[tuple[str, str]] = []
    for sheet in root.findall('m:sheets/m:sheet', NS):
        name = sheet.attrib['name']
        rel_id = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = 'xl/' + rel_map[rel_id].lstrip('/')
        sheets.append((name, target))
    return sheets


def drawing_images_for_sheet(zf: zipfile.ZipFile, sheet_index: int) -> dict[int, list[str]]:
    rels_path = f'xl/worksheets/_rels/sheet{sheet_index}.xml.rels'
    if rels_path not in zf.namelist():
        return {}
    rels_root = ET.fromstring(zf.read(rels_path))
    drawing_target = None
    for rel in rels_root.findall('rel:Relationship', NS):
        if 'drawing' in rel.attrib.get('Type', ''):
            drawing_target = rel.attrib['Target'].replace('../', 'xl/')
            break
    if not drawing_target or drawing_target not in zf.namelist():
        return {}

    drawing_root = ET.fromstring(zf.read(drawing_target))
    drawing_name = Path(drawing_target).name
    drawing_rels_path = f'xl/drawings/_rels/{drawing_name}.rels'
    media_map: dict[str, str] = {}
    if drawing_rels_path in zf.namelist():
        drels = ET.fromstring(zf.read(drawing_rels_path))
        for rel in drels.findall('rel:Relationship', NS):
            if 'image' in rel.attrib.get('Type', ''):
                media_map[rel.attrib['Id']] = rel.attrib['Target'].replace('../', 'xl/')

    by_row: dict[int, list[tuple[int, str]]] = {}
    anchors = drawing_root.findall('.//xdr:oneCellAnchor', NS) + drawing_root.findall('.//xdr:twoCellAnchor', NS)
    for anchor in anchors:
        from_el = anchor.find('xdr:from', NS)
        if from_el is None:
            continue
        row_el = from_el.find('xdr:row', NS)
        col_el = from_el.find('xdr:col', NS)
        if row_el is None or col_el is None:
            continue
        row = int(row_el.text or 0)
        col = int(col_el.text or 0)
        blip = anchor.find('.//a:blip', NS)
        if blip is None:
            continue
        embed = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
        media = media_map.get(embed or '')
        if media:
            by_row.setdefault(row, []).append((col, media))

    return {row: [media for _, media in sorted(items)] for row, items in by_row.items()}


def save_resized_image(zf: zipfile.ZipFile, media_path: str, dest: Path) -> None:
    image = Image.open(BytesIO(zf.read(media_path)))
    if image.mode not in ('RGB', 'L'):
        image = image.convert('RGB')
    if image.width > 720:
        ratio = 720 / image.width
        image = image.resize((720, int(image.height * ratio)), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, format='JPEG', quality=82, optimize=True)


def find_header_row(rows: dict[int, list]) -> tuple[int, dict[str, int]] | None:
    for row_idx in sorted(rows):
        labels = [normalize(str(cell)) if cell is not None else '' for cell in rows[row_idx]]
        if any('nazev' in label and 'cvik' in label for label in labels):
            mapping: dict[str, int] = {}
            for col, label in enumerate(labels):
                if 'nazev' in label and 'cvik' in label:
                    mapping['name'] = col
                elif label.startswith('fotka'):
                    mapping.setdefault('photos', col)
                elif 'uroven' in label or 'pokrocil' in label:
                    mapping['level'] = col
                elif 'zapojene' in label or 'sval' in label:
                    mapping['muscles'] = col
                elif 'poznam' in label:
                    mapping['notes'] = col
                elif 'opakov' in label or 'cas' in label:
                    mapping['prescription'] = col
                elif 'cilova' in label or 'oblast' in label:
                    mapping['target'] = col
            if 'name' in mapping:
                return row_idx, mapping
    return None


class Translator:
    def __init__(self) -> None:
        self.translator = GoogleTranslator(source='cs', target='en')
        self.cache: dict[str, str] = {}
        if TRANSLATION_CACHE.exists():
            self.cache = json.loads(TRANSLATION_CACHE.read_text(encoding='utf-8'))

    def save_cache(self) -> None:
        TRANSLATION_CACHE.write_text(
            json.dumps(self.cache, ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8',
        )

    def translate_many(self, texts: set[str]) -> None:
        pending = [text for text in texts if text and text not in self.cache]
        print(f'Translating {len(pending)} unique strings...')
        for index, text in enumerate(pending, start=1):
            try:
                if len(text) <= 4500:
                    self.cache[text] = self.translator.translate(text)
                else:
                    chunks = re.split(r'\n\n+', text)
                    translated_chunks = []
                    for chunk in chunks:
                        if chunk.strip():
                            translated_chunks.append(self.translator.translate(chunk))
                            time.sleep(0.1)
                    self.cache[text] = '\n\n'.join(translated_chunks)
            except Exception:
                self.cache[text] = text
            if index % 25 == 0:
                print(f'  {index}/{len(pending)}')
            time.sleep(0.08)

    def t(self, text: str | None) -> str:
        if text is None:
            return ''
        value = str(text).strip()
        if not value:
            return ''
        return self.cache.get(value, value)


def download_xlsx() -> None:
    if XLSX_PATH.exists() and XLSX_PATH.stat().st_size > 1_000_000:
        return
    import urllib.request

    print('Downloading xlsx...')
    with urllib.request.urlopen(XLSX_URL, timeout=180) as response:
        XLSX_PATH.write_bytes(response.read())


def main() -> None:
    download_xlsx()
    zf = zipfile.ZipFile(XLSX_PATH)
    shared_strings = load_shared_strings(zf)
    sheets = workbook_sheets(zf)
    raw_rows: list[dict] = []
    strings_to_translate: set[str] = set()

    for sheet_index, (sheet_name, sheet_path) in enumerate(sheets, start=1):
        exercise_type = infer_type_from_sheet(sheet_name)
        rows = read_sheet_rows(zf, sheet_path, shared_strings)
        header = find_header_row(rows)
        if not header:
            continue
        header_idx, columns = header
        intro_parts: list[str] = []
        for row_idx in sorted(rows):
            if row_idx >= header_idx:
                break
            for cell in rows[row_idx]:
                if isinstance(cell, str) and len(cell.strip()) > 80:
                    intro_parts.append(cell.strip())
        intro = '\n\n'.join(intro_parts)
        if intro:
            strings_to_translate.add(intro)

        for row_idx in sorted(rows):
            if row_idx <= header_idx:
                continue
            row = rows[row_idx]
            if not row or row[0] is None or not isinstance(row[0], (int, float)):
                continue
            name = row[columns['name']] if 'name' in columns else None
            if not name or not str(name).strip() or 'navrat' in normalize(str(name)):
                continue
            muscles = row[columns['muscles']] if 'muscles' in columns else ''
            notes = row[columns['notes']] if 'notes' in columns else ''
            level = row[columns['level']] if 'level' in columns else ''
            target = row[columns['target']] if 'target' in columns else ''
            prescription = row[columns['prescription']] if 'prescription' in columns else ''
            for value in (name, muscles, notes, level, target, prescription):
                if value:
                    strings_to_translate.add(str(value).strip())
            raw_rows.append(
                {
                    'sheet_index': sheet_index,
                    'row_idx': row_idx,
                    'exercise_type': exercise_type,
                    'name': str(name).strip(),
                    'muscles': str(muscles or '').strip(),
                    'notes': str(notes or '').strip(),
                    'level': str(level or '').strip(),
                    'target': str(target or '').strip(),
                    'prescription': str(prescription or '').strip(),
                    'intro': intro,
                }
            )

    translator = Translator()
    translator.translate_many(strings_to_translate)
    translator.save_cache()

    if PHOTOS_DIR.exists():
        import shutil

        shutil.rmtree(PHOTOS_DIR)
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

    used_ids: set[str] = set()
    exercises: list[dict] = []
    seen_sheet_intro: set[int] = set()

    for item in raw_rows:
        exercise_type = item['exercise_type']
        name_en = translator.t(item['name'])
        notes_en = translator.t(item['notes'])
        muscles_en = translator.t(item['muscles'])
        level_en = translator.t(item['level'])
        target_en = translator.t(item['target'])
        prescription_en = translator.t(item['prescription'])
        include_intro = item['sheet_index'] not in seen_sheet_intro
        if include_intro:
            seen_sheet_intro.add(item['sheet_index'])
        intro_en = translator.t(item['intro']) if include_intro else ''

        exercise_id = slugify(name_en, used_ids)
        muscle_group = infer_muscle_group(item['muscles'], exercise_type)
        instruction_parts = []
        if intro_en:
            instruction_parts.append(intro_en)
        if target_en:
            instruction_parts.append(f'Target area: {target_en}')
        if muscles_en:
            instruction_parts.append(f'Muscles worked: {muscles_en}')
        if level_en:
            instruction_parts.append(f'Level: {level_en}')
        if notes_en:
            instruction_parts.append(notes_en)

        prescription = parse_prescription(item['prescription'] or prescription_en, exercise_type)
        images_by_row = drawing_images_for_sheet(zf, item['sheet_index'])
        photo_paths: list[str] = []
        for photo_index, media_path in enumerate(images_by_row.get(item['row_idx'], [])[:3], start=1):
            dest = PHOTOS_DIR / exercise_id / f'{photo_index}.jpg'
            save_resized_image(zf, media_path, dest)
            photo_paths.append(f'/exercise-photos/{exercise_id}/{photo_index}.jpg')

        exercise: dict = {
            'id': exercise_id,
            'name': name_en,
            'muscleGroup': muscle_group,
            'instructions': '\n\n'.join(instruction_parts) or f'Perform {name_en} with controlled form.',
            'exerciseType': exercise_type,
            **prescription,
        }
        if photo_paths:
            exercise['instructionPhotos'] = photo_paths
            exercise['thumbnailPhotoIndex'] = 0
        if prescription_en:
            exercise['startingWeightNote'] = prescription_en
        elif level_en:
            exercise['startingWeightNote'] = level_en
        exercises.append(exercise)

    OUT_JSON.write_text(json.dumps(exercises, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(exercises)} exercises to {OUT_JSON}')


if __name__ == '__main__':
    main()
