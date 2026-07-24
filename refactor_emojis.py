import os
import re

FILES_TO_PROCESS = [
    'src/utils/rpg/dashboard.ts',
    'src/utils/rpg/town.ts',
    'src/utils/rpg/shop.ts',
    'src/utils/rpg/items.ts',
    'src/utils/rpg/weapons.ts',
    'src/utils/rpg/marches.ts',
    'src/utils/minigame.ts',
    'src/utils/rpg/bot_full_ai.ts',
    'src/utils/rpg/dungeon_v2.ts',
    'src/utils/rpg/world-boss.ts'
]

EMOJI_MAP = {
    '🪙': 'res_coin',
    '🪵': 'res_wood',
    '🪨': 'res_stone',
    '⛏️': 'res_iron',
    '🥩': 'res_meat',
    '🌾': 'res_grain',
    '💎': 'res_mystic',
    '⚔️': 'unit_infantry',
    '🛡️': 'btn_shield'
}

def refactor_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    # Determine import depth
    depth = file_path.count('/') - 1
    import_path = '../' * depth + 'utils/rpg/emojis' if depth > 0 else './rpg/emojis'
    if 'utils/rpg' in file_path:
        import_path = './emojis'

    needs_import = False
    
    # We will replace string instances. This is a bit tricky with template literals vs regular strings.
    # We will just replace the literal unicode char with ${EMOJIS.name} and ensure the string is a template literal,
    # or just replace the unicode char inside existing template literals.
    # To be safe and simple, let's just do a naive replace of the unicode char with ${EMOJIS.res_coin}.
    # This might break if it's inside a single quote string ('...'), so we also need to convert single quotes to backticks if we insert ${} inside them.
    
    for emoji, key in EMOJI_MAP.items():
        if emoji in content:
            needs_import = True
            content = content.replace(emoji, f"${{EMOJIS.{key}}}")
            
    if needs_import:
        # Convert single/double quotes to backticks if they contain ${EMOJIS
        # This is a bit advanced for regex, but let's try a simple approach: just replace ' with ` for lines that have ${EMOJIS
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if '${EMOJIS' in line:
                # If the line uses single quotes for the string containing ${EMOJIS, convert to backticks
                # E.g. 'You got ${EMOJIS.res_coin}' -> `You got ${EMOJIS.res_coin}`
                # We'll just replace ' with ` if there's no complex nesting.
                if "'" in line and '`' not in line:
                    lines[i] = line.replace("'", "`")

        content = '\n'.join(lines)
        
        # Add import at the top
        if 'import { EMOJIS }' not in content:
            # find first import
            import_statement = f"import {{ EMOJIS }} from '{import_path}';\n"
            content = import_statement + content

    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {file_path}")

for f in FILES_TO_PROCESS:
    refactor_file(f)
