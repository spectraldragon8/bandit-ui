# customUI for Bandit.RIP

A userscript that restyles [bandit.rip](https://bandit.rip): brush-stroke menu, animated scenes, a profile hub with leaderboard medals, and a mod menu.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (or Violentmonkey).
2. Open **[customui.user.js](https://raw.githubusercontent.com/spectraldragon8/bandit-ui/main/customui.user.js)** and click **Install**.
3. Go to bandit.rip. Pick a scene when asked. **Alt+G** switches the whole look on or off.

Updates install automatically through Tampermonkey.

## What's in this repo

```
customui.user.js     the userscript people install
themes/
  themes.txt         list of scenes shown in the THEME menu
  ccity.theme        Cyberpunk City
  hotel.theme        The Hotel
mods/
  mods.txt           list of mods shown in the MODS menu
  shadowclient.js    ShadowClient training tools
assets/
  dancingemy.gif     loading-screen Emy
```

## Adding a scene

1. Copy an existing `.theme` file in `themes/` and edit its `build`, `drawBack` and `drawFront` functions (the comment at the top of each theme explains what they get).
2. Add a line to `themes/themes.txt`: `Display Name : file` (optionally `: preview.jpg` for a hand-made preview picture).

## Adding a mod

1. Put the mod's JavaScript in `mods/<name>.js`. It runs in the page, the same way a normal userscript with `@grant none` would.
2. Add a line to `mods/mods.txt`: `Display Name : name : short description`.

Deleting a mod's line from `mods.txt` stops it loading for everyone on their next visit.
