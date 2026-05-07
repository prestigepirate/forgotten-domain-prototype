"""Generate card thumbnail images using xAI Grok image API."""
import requests, json, os, re, time, sys

API_KEY = "xai-71e9byNe8G4coGS4n2RYpean1KMqT0B20pOhj7oqHyDS7Q6fuJWUysFEBzUFlptj83vK20gmbP3PNA9i"
API_URL = "https://api.x.ai/v1/images/generations"
OUT_DIR = "public/cards"

def load_cards(path):
    with open(path) as f:
        text = f.read()
    keys_block = re.search(r'export const CARD_DATABASE = \{(.*?)\};', text, re.DOTALL)
    entries = re.findall(r'"([^"]+)":\s*\{([^}]+(?:{[^}]*}[^}]*)?)\}', keys_block.group(1), re.DOTALL)
    cards = []
    for key, body in entries:
        name = re.search(r'name:\s*"([^"]+)"', body)
        ctype = re.search(r'type:\s*"([^"]+)"', body)
        effect = re.search(r'effect:\s*"([^"]+)"', body)
        element = re.search(r'element:\s*"([^"]+)"', body)
        kind = re.search(r'kind:\s*"([^"]+)"', body)
        atk = re.search(r'atk:\s*(\d+)', body)
        deff = re.search(r'def:\s*(\d+)', body)
        cards.append({
            "id": key,
            "name": name.group(1) if name else key,
            "type": ctype.group(1) if ctype else "?",
            "effect": effect.group(1) if effect else "",
            "element": element.group(1) if element else "",
            "kind": kind.group(1) if kind else "",
            "atk": int(atk.group(1)) if atk else 0,
            "def": int(deff.group(1)) if deff else 0,
        })
    return cards

def build_prompt(card):
    name = card["name"]
    ctype = card["type"]
    effect = card["effect"]
    element = card["element"]
    kind = card["kind"]

    base = "dark fantasy art style, card game illustration, dramatic lighting, serious tone, clean composition, no text, no UI, no words"

    if ctype == "creature":
        elem_desc = {"dark": "shadowy", "light": "radiant", "fire": "fiery",
                     "water": "aquatic", "earth": "earthen", "wind": "stormy",
                     "void": "eldritch cosmic"}.get(element, "mystical")
        return (f"Fantasy creature portrait of {name}, a {elem_desc} {kind}, "
                f"powerful and imposing, {base}")

    elif ctype == "spell":
        visual = effect.replace("target region", "the battlefield").replace("target creature", "a warrior")
        return f"Magical spell effect: {name} — {visual}, arcane energy visualization, {base}"

    elif ctype == "trap":
        return f"Hidden trap: {name} — {effect}, sense of imminent danger and ambush, {base}"

    elif ctype == "equipment":
        return f"Magical item: {name}, detailed fantasy weapon or armor design, glowing enchantment, {base}"

    elif ctype == "field":
        return f"Fantasy landscape: {name} — {effect}, sweeping atmospheric terrain, {base}"

    return f"Fantasy card art of {name}, {base}"

def generate_image(card, out_dir):
    filename = os.path.join(out_dir, f"{card['id']}.jpg")
    if os.path.exists(filename):
        print(f"  SKIP (exists): {card['name']}")
        return True

    prompt = build_prompt(card)
    print(f"  Generating: {card['name']} ({card['type']})")
    print(f"    Prompt: {prompt[:120]}...")

    try:
        resp = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json={"model": "grok-imagine-image-pro", "prompt": prompt, "n": 1},
            timeout=120,
        )
        if resp.status_code != 200:
            print(f"    ERROR: HTTP {resp.status_code}: {resp.text[:200]}")
            return False

        result = resp.json()
        if "error" in result:
            print(f"    ERROR: {result['error']}")
            return False

        url = result["data"][0]["url"]
        img_resp = requests.get(url, timeout=60)
        with open(filename, "wb") as f:
            f.write(img_resp.content)
        print(f"    SAVED: {filename} ({len(img_resp.content)} bytes)")
        return True

    except Exception as e:
        print(f"    EXCEPTION: {e}")
        return False

def main():
    cards = load_cards("src/data/cards.js")
    print(f"Loaded {len(cards)} cards")

    os.makedirs(OUT_DIR, exist_ok=True)

    # Optional: filter to specific cards via command line args
    args = sys.argv[1:]
    if args:
        cards = [c for c in cards if c["id"] in args]
        print(f"Filtered to {len(cards)} cards")

    success = 0
    fail = 0
    for i, card in enumerate(cards):
        print(f"\n[{i+1}/{len(cards)}]", end=" ")
        if generate_image(card, OUT_DIR):
            success += 1
        else:
            fail += 1
        if i < len(cards) - 1:
            time.sleep(1.5)  # rate limit buffer

    print(f"\nDone. {success} success, {fail} failed, {len(cards)} total")

if __name__ == "__main__":
    main()
