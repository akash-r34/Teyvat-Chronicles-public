#!/usr/bin/env bash
set -euo pipefail
DEST_BGM="public/audio/bgm"
DEST_SFX="public/audio/sfx"
mkdir -p "$DEST_BGM" "$DEST_SFX"

# --- BGM (CC0, OpenGameArt) ---
BGM_LIST=(
  "peaceful_town|https://opengameart.org/sites/default/files/TownTheme.mp3"
  "peaceful_alt|https://opengameart.org/sites/default/files/peaceful_town.mp3"
  "town_day|https://opengameart.org/sites/default/files/TOWN%201.mp3"
  "town_evening|https://opengameart.org/sites/default/files/TOWN%202.mp3"
  "market|https://opengameart.org/sites/default/files/Market%20theme%201_0.mp3"
  "heroic|https://opengameart.org/sites/default/files/FantasyOrchestralTheme_1.mp3"
  "battle_epic|https://opengameart.org/sites/default/files/battleThemeA.mp3"
  "battle_jrpg_intro|https://opengameart.org/sites/default/files/jrpg_battle_intro.mp3"
  "battle_jrpg_loop|https://opengameart.org/sites/default/files/jrpg_battle_loop.mp3"
  "battle_jrpg_full|https://opengameart.org/sites/default/files/jrpg_battle_full_0.mp3"
  "boss|https://opengameart.org/sites/default/files/CleytonRX%20-%20Battle%20RPG%20Theme_1.mp3"
  "dungeon|https://opengameart.org/sites/default/files/heavy_dungeon_bpm160.mp3"
  "mystery|https://opengameart.org/sites/default/files/GameMusic_ForestTheme_24_0.mp3"
)

for item in "${BGM_LIST[@]}"; do
  name="${item%%|*}"
  url="${item#*|}"
  curl -fsSL --retry 3 -o "$DEST_BGM/$name.mp3" "$url"
  echo "  ✔ bgm/$name.mp3"
done

# --- SFX (CC0, Kenney.nl) ---
TMP=$(mktemp -d)
curl -fsSL -o "$TMP/iface.zip"  "https://kenney.nl/media/pages/assets/interface-sounds/d23a84242e-1677589452/kenney_interface-sounds.zip"
curl -fsSL -o "$TMP/rpg.zip"    "https://kenney.nl/media/pages/assets/rpg-audio/706161bc16-1677590336/kenney_rpg-audio.zip"
curl -fsSL -o "$TMP/impact.zip" "https://kenney.nl/media/pages/assets/impact-sounds/8aa7b545c9-1677589768/kenney_impact-sounds.zip"
unzip -qo "$TMP/iface.zip"  -d "$TMP/iface"
unzip -qo "$TMP/rpg.zip"    -d "$TMP/rpg"
unzip -qo "$TMP/impact.zip" -d "$TMP/impact"

cp "$TMP/iface/Audio/click_002.ogg"        "$DEST_SFX/ui_click.ogg"
cp "$TMP/iface/Audio/click_005.ogg"        "$DEST_SFX/ui_hover.ogg"
cp "$TMP/iface/Audio/select_002.ogg"       "$DEST_SFX/ui_choice.ogg"
cp "$TMP/iface/Audio/confirmation_002.ogg" "$DEST_SFX/ui_confirm.ogg"
cp "$TMP/iface/Audio/glass_006.ogg"        "$DEST_SFX/ui_action.ogg"
cp "$TMP/rpg/Audio/handleSmallLeather2.ogg" "$DEST_SFX/sword_unsheathe.ogg"
cp "$TMP/rpg/Audio/metalLatch.ogg"          "$DEST_SFX/sword_swing.ogg"
cp "$TMP/rpg/Audio/cloth1.ogg"              "$DEST_SFX/magic_cast.ogg"
cp "$TMP/impact/Audio/impactPunch_medium_001.ogg" "$DEST_SFX/impact_hit.ogg"
cp "$TMP/impact/Audio/impactPunch_heavy_000.ogg" "$DEST_SFX/explosion.ogg"
cp "$TMP/iface/Audio/bong_001.ogg"          "$DEST_SFX/page_turn.ogg"
cp "$TMP/impact/Audio/footstep_concrete_004.ogg" "$DEST_SFX/dramatic_sting.ogg"

# Convert all OGG to MP3 for universally supported cross-browser compatibility
echo "Converting .ogg to .mp3..."
for f in "$DEST_SFX"/*.ogg; do
  if [ -f "$f" ]; then
    ffmpeg -y -loglevel error -nostdin -i "$f" -c:a libmp3lame -q:a 2 "${f%.ogg}.mp3"
    rm "$f"
  fi
done

rm -rf "$TMP"
echo "Audio assets fetched into public/audio/"
