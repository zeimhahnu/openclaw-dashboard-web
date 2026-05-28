# Feature: Dashboard RPG v2 — Meaningful Monsters & Agent States

> Status: INBOX
> Created: 2026-05-28
> Owner: Goop (PO), Mason (implementation)
> Priority: high

---

## Core Narrative

**"Defending the Fortress of Persistent Memory"**

The dashboard shows a top-down fortress view. Three defender agents (Lil Claw, Goop, Mason) guard the fortress walls. Monsters spawn from outside — each representing a real problem that needs solving. Defeating a monster means completing its associated task.

**The world:** A fortified tower/server room hybrid. Agents are knight-consultants. Monsters are threat-entities drawn to incomplete work: chaos spirits, knowledge gaps, build failures, security breaches.

---

## Monster Taxonomy

Four monster types, determined by task category at spawn time:

| Type | Glyph | Spawns From | Visual |
|------|-------|-------------|--------|
| **Chaos** | `Spiral` | Stuck processes, backlog, failed tasks | Tangle/vines, dark purple, jittery motion |
| **Threat** | `ShieldAlert` | Security breaches, system failures, uptime incidents | Spiky, red-orange, aggressive posture |
| **Knowledge** | `BookOpen` | Research gaps, unverified claims, outdated docs | Wispy, pale blue, ethereal/dissolving edges |
| **Build** | `Hammer` | Failed builds, code debt, broken implementations | Chunky, orange-rust, solid/heavy |

**Monster lifecycle:**
- Monster spawns when task is created (not when it fails)
- Monster sits **queued** — writhing, pressing against the fortress edge (idle animation)
- When agent picks up the task → monster goes **engaged** — fighting animation, contact with agent
- On task completion → monster **defeated** — death animation (dissolve/shatter), +XP flash
- On task failure → monster **retreats** — shrinks back, returns to queue, marked "retrying"
- On max retries exhausted → monster **escapes** — runs off screen, marked "escaped"

**Failed tasks no longer wound agents.** The agent tried and retreated. The monster remains fightable. This is accurate — a failed task is a retreating problem, not a wounded agent.

---

## Agent States

Each agent card shows their current operational state:

| State | Trigger | Visual |
|-------|---------|--------|
| **Idle** | No tasks in queue for this agent | Gentle breathing animation, tools at rest, soft glow |
| **Working** | Agent actively processing a task | Weapon/tool raised, fighting stance, monster contact |
| **Helping** | Agent assisting another agent (cross-agent spawn) | Blue aura, supporting position beside primary agent |
| **Heavy Load** | 3+ tasks in queue for this agent | Pulsing orange glow, slight strain animation |
| **Stuck** | Task in queue >15min without pickup | Greyed out, slow pulse, "!" indicator |
| **Offline** | Heartbeat file >5min stale | Dimmed card, no glow, desaturated |

**Idle animation for Mason (builder specialist):** Hammer tapping, blueprint sketches, sparks — distinct from Lil Claw's and Goop's idle poses.

---

## Summoning Animation (sessions_spawn → helper)

**Type:** Global ripple (B) — entire board sees the summons

**Trigger:** `sessions_spawn` fires → agent A calls agent B as helper

**Sequence (total ~1.5s):**

1. **Ritual circle expands** (0–350ms): Glowing sigil ring expands from board center outward, concentric circles ripple. Color: gold/amber.
2. **Runes orbit inward** (200–600ms): 4 rune glyphs (`Sparkles`, `Wand2`, `CircleDot`, `Star`) appear at board edges, orbit inward toward agent A's card. Staggered 80ms apart. Each leaves a faint trail.
3. **Particle burst + materialization** (600–800ms): Glyphs converge on agent A's card → bright flash → helper agent B materializes with a glow ring.
4. **Circle dissolves** (800–1100ms): Ripple fades, glyphs shatter/dissolve, board returns to normal.
5. **Caster "casts" state** (800–1500ms): Agent A briefly shows casting pose (raised hand/tool), blue-ish tint.

**Accessibility:** `prefers-reduced-motion` → skip to instant materialization (no animation).

---

## Fighting Animations

When agent is in **Working** state (actively fighting their monster):

- Agent card: weapon/tool raised, slight forward lean, impact flash on hit
- Monster: recoil on each "hit" (task progress update), color flash red
- On task progress: small particle hit effect on monster
- On task completion: monster death animation (varies by type: dissolve, shatter, flee, crumble)

**Hit animation per monster type:**
- Chaos: tangle snaps, purple sparks
- Threat: recoil + red flash, sparks
- Knowledge: pages scatter, blue wisps dissipate
- Build: chunks fall off, orange debris

---

## Data Model Changes

### API: `/api/tasks/events`
Add `event_type` field to distinguish event types:
```json
{
  "id": "evt-001",
  "event_type": "summon",        // new: summon | task_queued | task_engaged | task_defeated | task_escaped
  "agent_id": "goop",
  "helper_id": "mason",          // only for summon events
  "task_id": "task-xxx",
  "monster_type": "build",       // new: chaos | threat | knowledge | build
  "timestamp": "2026-05-28T14:00:00Z"
}
```

### Frontend state
- `monsters: Monster[]` — all active monsters, keyed by task_id
- `agents: AgentState[]` — current state per agent
- `summonEffect: SummonEffect | null` — current animation state

---

## File Changes

### New components
- `src/components/SummonEffect.tsx` — full-screen ritual circle + rune orbit + particle burst
- `src/components/MonsterSprite.tsx` — per-type monster sprite with idle/fighting/death/retreat states
- `src/hooks/useAgentState.ts` — derives agent state from heartbeat + task queue

### Modified components
- `src/app/page.tsx` — add SummonEffect overlay, update GuildWorld to use MonsterSprite
- `src/components/GuildWorld.tsx` — replace static monster sprites with MonsterSprite + state machine
- `src/components/AgentStatusCard.tsx` — add idle/working/helping/heavy/stuck/offline visual states

### API changes
- `src/app/api/tasks/events/route.ts` — add event_type + monster_type fields

---

## Acceptance Criteria

1. Monster type is visually distinguishable at a glance (4 distinct silhouettes/colors)
2. Failed task → agent NOT wounded; monster retreats to queue
3. Spell animation is global (full board ripple) and completes in ~1.5s
4. Mason's idle animation is distinct (builder/hammer motif) — not same as Lil Claw/Goop
5. Agent state reflects reality: idle/working/helping/heavy/stuck/offline
6. `prefers-reduced-motion` users see instant state changes, no animation
7. Mobile responsive at 3 breakpoints
8. All animations respect WCAG 2.1 AA contrast ratios
