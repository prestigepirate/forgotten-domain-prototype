"""Generate deck cover images using Grok (xAI) image API."""

import requests
import time
import os
import sys

API_KEY = "xai-71e9byNe8G4coGS4n2RYpean1KMqT0B20pOhj7oqHyDS7Q6fuJWUysFEBzUFlptj83vK20gmbP3PNA9i"
API_URL = "https://api.x.ai/v1/images/generations"
MODEL = "grok-imagine-image-pro"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "decks")
BASE_URL = os.environ.get("BASE_URL", "/ygo-strategy/")

DECKS = [
    {
        "id": "dragons-fury",
        "name": "Dragon's Fury",
        "color": "#cc4422",
        "prompt": (
            "Epic dark fantasy card game deck cover for 'Dragon's Fury'. "
            "A massive crimson dragon soaring over jagged volcanic mountain peaks, "
            "breathing fire across a burning sky. The dragon is immense and terrifying, "
            "scales glowing with internal heat. Below, a fortress built into the mountainside. "
            "Dark fantasy art style, dramatic lighting, rich colors, card game illustration, "
            "no text, no logos, no UI elements."
        ),
    },
    {
        "id": "spellcasters-arcana",
        "name": "Spellcaster's Arcana",
        "color": "#4466cc",
        "prompt": (
            "Epic dark fantasy card game deck cover for 'Spellcaster's Arcana'. "
            "A hooded wizard standing in an ancient arcane library, hands raised, "
            "conjuring swirling blue magical energy in a vortex around them. "
            "Floating spellbooks, glowing runes, and mystical symbols orbit the wizard. "
            "Deep blue and purple color palette, ethereal atmosphere, card game illustration, "
            "no text, no logos, no UI elements."
        ),
    },
    {
        "id": "zombie-horde",
        "name": "Zombie Horde",
        "color": "#7744aa",
        "prompt": (
            "Epic dark fantasy card game deck cover for 'Zombie Horde'. "
            "An endless legion of undead rising from a misty purple swamp at night. "
            "A towering zombie dragon in the center, skeletal wings spread wide, "
            "emitting a sickly green glow. Decayed hands reaching up from murky water. "
            "Purple and green necromantic energy, horror fantasy atmosphere, card game illustration, "
            "no text, no logos, no UI elements."
        ),
    },
    {
        "id": "warriors-vanguard",
        "name": "Warrior's Vanguard",
        "color": "#44aa22",
        "prompt": (
            "Epic dark fantasy card game deck cover for 'Warrior's Vanguard'. "
            "A disciplined battalion of armored forest guardians standing at the edge of an "
            "ancient enchanted woodland. They wield glowing swords and shields, green banners "
            "billowing in wind. A colossal ancient tree spirit looms behind them as their protector. "
            "Emerald and gold tones, noble atmosphere, card game illustration, "
            "no text, no logos, no UI elements."
        ),
    },
    {
        "id": "shadow-dominion",
        "name": "Shadow Dominion",
        "color": "#222244",
        "prompt": (
            "Epic dark fantasy card game deck cover for 'Shadow Dominion'. "
            "A sinister dark fortress wreathed in deep shadow, perched on a cliff overlooking "
            "a mist-shrouded abyss. Demon-like fiends with glowing red eyes lurk in the shadows, "
            "and spiked chains hang from the ramparts. Dark purple-black atmosphere, "
            "ominous and threatening mood, card game illustration, "
            "no text, no logos, no UI elements."
        ),
    },
    {
        "id": "fracture-protocol",
        "name": "Fracture Protocol",
        "color": "#8866ff",
        "prompt": (
            "Epic dark fantasy card game deck cover for 'Fracture Protocol'. "
            "Reality itself fracturing open above a volcanic wasteland, revealing a void of "
            "quantum-entropic energy. Crystalline void constructs emerge from the rift, "
            "their geometric forms glowing with violet and magenta light. Below, magma flows "
            "through cracks in obsidian ground. Sci-fi dark fantasy blend, cosmic horror energy, "
            "card game illustration, no text, no logos, no UI elements."
        ),
    },
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    # Filter by deck ID if provided
    filter_ids = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    to_generate = [d for d in DECKS if filter_ids is None or d["id"] in filter_ids]

    print(f"Generating {len(to_generate)} deck cover(s)...")

    for deck in to_generate:
        out_path = os.path.join(OUT_DIR, f"{deck['id']}.jpg")
        if os.path.exists(out_path):
            print(f"  SKIP {deck['name']} — already exists at {out_path}")
            continue

        print(f"  GENERATING {deck['name']} ...")
        resp = requests.post(
            API_URL,
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json={"model": MODEL, "prompt": deck["prompt"], "n": 1},
            timeout=120,
        )

        if resp.status_code != 200:
            print(f"    ERROR {resp.status_code}: {resp.text[:300]}")
            continue

        data = resp.json()
        image_url = data.get("data", [{}])[0].get("url")
        if not image_url:
            print(f"    ERROR: No image URL in response: {data}")
            continue

        # Download the image
        img_resp = requests.get(image_url, timeout=60)
        if img_resp.status_code != 200:
            print(f"    ERROR downloading image: {img_resp.status_code}")
            continue

        with open(out_path, "wb") as f:
            f.write(img_resp.content)

        size_kb = len(img_resp.content) / 1024
        print(f"    SAVED {deck['name']} → {out_path} ({size_kb:.0f} KB)")

        # Rate limit
        time.sleep(2.0)

    print("Done.")


if __name__ == "__main__":
    main()
