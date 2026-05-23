# 🚀 SPACE FIGHTER
### Multi-Agent 2D Space Combat Game

**🌐 Live Demo → [space-fighter-nine.vercel.app](https://space-fighter-nine.vercel.app)**

---

## 📌 About

Space Fighter is a 2D browser-based space shooter built with pure HTML5, CSS3, and JavaScript (Canvas API). No frameworks, no libraries — everything from scratch.

The project was designed to cover 4 university subjects simultaneously:

| Subject | Implementation |
|---|---|
| 🤖 **Multi-Agent Systems** | Enemy agents with Finite State Machine (FSM) AI |
| 🖥 **Embedded Systems** | WASD, arrow keys, and Gamepad API (joystick) support |
| ☁️ **Cloud Computing** | Deployed and served via Vercel cloud infrastructure |
| 🏗 **Computer Architecture** | Game loop, rendering pipeline, memory management in JS |

---

## 🎮 How to Play

**Single Player**
| Key | Action |
|---|---|
| `W A S D` or `↑ ↓ ← →` | Move ship |
| `Space` or `Left Click` | Shoot |
| Joystick | Also supported via Gamepad API |

**VS Mode (2 Players on same keyboard)**
| Player | Move | Shoot |
|---|---|---|
| P1 | `W A S D` | `Space` |
| P2 | `I J K L` | `Left Shift` |
| P2 alt | Gamepad / Joystick | `A` or `R2` |

---

## 🤖 Multi-Agent System Design

Each enemy is an **independent agent** that perceives the environment and makes decisions using a **Finite State Machine (FSM)**.

```
Agent Types:
┌─────────────┬─────────────────────────────────────────────────────┐
│ Patrol      │ PATROL ──(player nearby)──► ATTACK                  │
│             │ ATTACK ──(player far)────► PATROL                   │
├─────────────┼─────────────────────────────────────────────────────┤
│ Chaser      │ Always chases nearest player. Shoots when in range. │
├─────────────┼─────────────────────────────────────────────────────┤
│ Kamikaze    │ Charges directly at player. No state transitions.   │
├─────────────┼─────────────────────────────────────────────────────┤
│ Boss        │ 3-phase FSM based on remaining HP:                  │
│             │  Phase 1 (HP > 66%) → slow orbit + single shots     │
│             │  Phase 2 (HP > 33%) → fast orbit + spread shots     │
│             │  Phase 3 (HP < 33%) → charges + rapid spread shots  │
└─────────────┴─────────────────────────────────────────────────────┘
```

In VS Mode, all agents target the **nearest alive player** — a true multi-agent interaction.

---

## ⚡ Powerups

Powerups spawn randomly on the map and disappear after 12 seconds if not collected.

| Powerup | Effect | Duration |
|---|---|---|
| 🛡 **Shield** | Blocks all damage | 5 sec |
| ❤ **Repair** | Restores +40 HP | Instant |
| ⚡ **Speed** | 2× movement speed | 6 sec |
| 🔥 **Rapid Fire** | 3× shooting speed | 6 sec |
| 🌀 **360° Fire** | Shoots in all 8 directions | 7 sec |

---

## 🎯 Difficulty Levels

| | 🟢 Easy | 🟡 Medium | 🔴 Hard |
|---|---|---|---|
| Enemies per wave | 2 + wave | 3 + wave×2 | 5 + wave×3 |
| Enemy HP | ×0.6 | ×1.0 | ×1.5 |
| Enemy speed | ×0.7 | ×1.0 | ×1.4 |
| Bullet speed | 200 | 280 | 380 |
| Powerup interval | 10s | 15s | 25s |
| Boss HP | ×0.6 | ×1.0 | ×1.6 |

---

## 🏆 Stage Progression

Every 5th wave spawns a **Boss** — defeating it clears the stage:

```
Wave 1 → 2 → 3 → 4 → BOSS (Wave 5)
                            ↓
                     ★ STAGE CLEAR
                     ★ Bonus score
                     ★ +30 HP reward
                            ↓
Wave 6 → 7 → 8 → 9 → BOSS (Wave 10) ← stronger
                            ↓
                     ... infinite progression
```

---

## 🔊 Sound System

All audio is **procedurally generated** using the Web Audio API — no external sound files needed.

- 🎵 Background chiptune music (procedural melody + bass)
- 💥 Explosion SFX (noise burst synthesis)
- 🔫 Shoot SFX (oscillator)
- ⬆ Powerup collect (ascending arpeggio)
- 🔇 Mute/unmute toggle button in-game

---

## 📁 Project Structure

```
space-fighter/
├── index.html   — HTML structure and UI elements
├── style.css    — All styling, animations, HUD layout
└── game.js      — Full game engine (AI, physics, rendering, audio)
```

---

## ☁️ Cloud Deployment

Deployed on **Vercel** — a cloud platform that serves the game globally via CDN edge nodes.

- **URL:** https://space-fighter-nine.vercel.app
- **Platform:** Vercel (Serverless / Edge Network)
- **Deploy method:** GitHub integration (auto-deploys on every push)
- **Infrastructure:** Cloud CDN — no dedicated server required

---

## 🛠 Technologies

- **HTML5 Canvas API** — 2D rendering engine
- **Web Audio API** — Procedural sound synthesis
- **Gamepad API** — Joystick / controller support
- **Vercel** — Cloud hosting and CDN deployment
- **Pure JavaScript** — No frameworks or libraries

---

## 👨‍💻 Author

Built as a university project covering Multi-Agent Systems, Embedded Systems, Cloud Computing, and Computer Architecture.
