// Computer gegen Computer im Turnier (SPEC 8.3): Die Partie wird sofort ausgespielt – Dart für Dart mit denselben
// Regeln und derselben Zielwahl wie im Spiel – und als normale Ereignisse zurückgegeben.

import { computeAtc, confirmAtcTurn, throwAtcDart } from './atc';
import { BOT_SIGMA, BOT_SIGMA_HUMAN, aimPoint, gaussian, planAim, throwAtPoint, type Point } from './bot';
import { botAim, botSigma } from './botaim';
import { coinOrder, distanceMm } from './bulloff';
import { computeCountUp, confirmCountUpTurn, throwCountUpDart } from './countup';
import { computeCricket, confirmCricketTurn, throwCricketDart } from './cricket';
import type { GameCreatedPayload, GameEvent, NewAppEvent, NewEvent, Participant } from './events';
import { atcSetupOf, countUpSetupOf, cricketSetupOf, halveItSetupOf, shanghaiSetupOf, x01SetupOf, type AnyGameState, type GameInfo } from './games';
import { computeHalveIt, confirmHalveItTurn, throwHalveItDart } from './halveit';
import { computeShanghai, confirmShanghaiTurn, decideShanghai, throwShanghaiDart } from './shanghai';
import { BULL, type Field } from './types';
import { computeX01, confirmTurn, throwDart } from './x01';

/** Höchstens so viele Darts, falls zwei sehr schwache Computer nie fertig würden. */
const MAX_DARTS = 20000;

interface Driver {
  compute(evs: GameEvent[]): AnyGameState;
  throwAt(g: AnyGameState, f: Field): NewEvent | null;
  confirm(g: AnyGameState): NewEvent[];
}

function driverOf(game: GameInfo): Driver {
  switch (game.created.mode) {
    case 'x01': {
      const setup = x01SetupOf(game);
      return {
        compute: (evs) => ({ mode: 'x01', state: computeX01(setup, evs) }),
        throwAt: (g, f) => throwDart((g as Extract<AnyGameState, { mode: 'x01' }>).state, f, 'bot'),
        confirm: (g) => confirmTurn((g as Extract<AnyGameState, { mode: 'x01' }>).state),
      };
    }
    case 'cricket': {
      const setup = cricketSetupOf(game);
      return {
        compute: (evs) => ({ mode: 'cricket', state: computeCricket(setup, evs) }),
        throwAt: (g, f) => throwCricketDart((g as Extract<AnyGameState, { mode: 'cricket' }>).state, f, 'bot'),
        confirm: (g) => confirmCricketTurn((g as Extract<AnyGameState, { mode: 'cricket' }>).state),
      };
    }
    case 'shanghai': {
      const setup = shanghaiSetupOf(game);
      return {
        compute: (evs) => ({ mode: 'shanghai', state: computeShanghai(setup, evs) }),
        throwAt: (g, f) => throwShanghaiDart((g as Extract<AnyGameState, { mode: 'shanghai' }>).state, f, 'bot'),
        confirm: (g) => {
          const s = (g as Extract<AnyGameState, { mode: 'shanghai' }>).state;
          // Nach einem Shanghai beendet der Computer das Spiel (er gewinnt damit)
          return s.pendingDecision ? decideShanghai(s, true) : confirmShanghaiTurn(s);
        },
      };
    }
    case 'countup': {
      const setup = countUpSetupOf(game);
      return {
        compute: (evs) => ({ mode: 'countup', state: computeCountUp(setup, evs) }),
        throwAt: (g, f) => throwCountUpDart((g as Extract<AnyGameState, { mode: 'countup' }>).state, f, 'bot'),
        confirm: (g) => confirmCountUpTurn((g as Extract<AnyGameState, { mode: 'countup' }>).state),
      };
    }
    case 'atc': {
      const setup = atcSetupOf(game);
      return {
        compute: (evs) => ({ mode: 'atc', state: computeAtc(setup, evs) }),
        throwAt: (g, f) => throwAtcDart((g as Extract<AnyGameState, { mode: 'atc' }>).state, f, 'bot'),
        confirm: (g) => confirmAtcTurn((g as Extract<AnyGameState, { mode: 'atc' }>).state),
      };
    }
    case 'halveit': {
      const setup = halveItSetupOf(game);
      return {
        compute: (evs) => ({ mode: 'halveit', state: computeHalveIt(setup, evs) }),
        throwAt: (g, f) => throwHalveItDart((g as Extract<AnyGameState, { mode: 'halveit' }>).state, f, 'bot'),
        confirm: (g) => confirmHalveItTurn((g as Extract<AnyGameState, { mode: 'halveit' }>).state),
      };
    }
    default:
      throw new Error(`Automatisches Ausspielen gibt es für ${game.created.mode} nicht.`);
  }
}

/** Ein Ausbullen-Wurf des Computers: Stelle in mm um den Mittelpunkt (wie beim Ausbullen im Spiel). */
export function botBullThrow(p: Participant, random: () => number): { xMm: number; yMm: number; distanceMm: number } {
  const sigma = (p.botHuman === false ? BOT_SIGMA : BOT_SIGMA_HUMAN)[p.botLevel ?? 5];
  const c = aimPoint({ n: BULL, m: 2 });
  const x = Math.round((c.x + gaussian(random) * sigma) * 10) / 10;
  const y = Math.round((c.y + gaussian(random) * sigma) * 10) / 10;
  return { xMm: x, yMm: y, distanceMm: distanceMm(x, y) };
}

/**
 * Ausbullen zweier Computer bis zur Entscheidung. Liefert die bulloff.throw-Ereignisse und den Sieger (Slot).
 * `gameId` ist die Kennung, unter der die Würfe stehen.
 */
export function simulateBulloff(players: readonly Participant[], gameId: string, random: () => number): { events: NewAppEvent[]; order: number[] } {
  const events: NewAppEvent[] = [];
  for (let attempt = 1; attempt < 100; attempt++) {
    const results = players.map((p) => {
      const t = botBullThrow(p, random);
      events.push({ type: 'bulloff.throw', payload: { gameId, slot: p.slot, attempt, ...t } });
      return { slot: p.slot, d: t.distanceMm };
    });
    if (results[0].d !== results[1].d) {
      return { events, order: results.sort((a, b) => a.d - b.d).map((r) => r.slot) };
    }
  }
  return { events, order: players.map((p) => p.slot) };
}

/**
 * Spielt ein frisch angelegtes Spiel zweier Computer ganz aus. `created` ist das game.created-Ereignis;
 * zurück kommen alle folgenden Ereignisse bis einschließlich game.ended.
 */
export function autoPlayGame(created: GameCreatedPayload, random: () => number): NewAppEvent[] {
  const out: NewAppEvent[] = [];
  const gameId = created.gameId;
  const slots = created.participants.map((x) => x.slot);
  // Wer beginnt: wie eingestellt
  let order = slots;
  if (created.start === 'coin') order = coinOrder(slots, random);
  if (created.start === 'bull') {
    const b = simulateBulloff(created.participants, gameId, random);
    out.push(...b.events);
    order = b.order;
  }
  out.push({ type: 'game.orderDecided', payload: { gameId, order, method: created.start ?? 'asEntered' } });

  const game: GameInfo = { created, createdAt: 0, order, ended: null, hidden: false, orderDecided: true };
  const driver = driverOf(game);
  const evs: GameEvent[] = [];
  let n = 0;
  const add = (e: NewEvent) => {
    evs.push({ ...e, id: `auto-${n++}`, ts: n } as GameEvent);
    out.push(e);
  };
  let stuck: { key: string; points: Point[] } = { key: '', points: [] };
  for (let darts = 0; darts < MAX_DARTS; ) {
    const g = driver.compute(evs);
    const s = g.state;
    if (s.finished) break;
    if (s.awaitingConfirm || ('pendingDecision' in s && s.pendingDecision)) {
      const c = driver.confirm(g);
      if (!c.length) break;
      c.forEach(add);
      continue;
    }
    const pos = s.next;
    const wanted = botAim(g);
    const bot = created.participants.find((x) => x.slot === pos?.slot);
    if (!pos || !wanted || !bot) break;
    const turnKey = `${pos.leg}|${pos.slot}|${pos.turnIndex}`;
    if (stuck.key !== turnKey) stuck = { key: turnKey, points: [] };
    const plan = planAim(wanted, stuck.points);
    const thrown = throwAtPoint(plan.point, botSigma(g, created.seed, bot, plan.target), random);
    stuck.points.push(thrown.point);
    const e = driver.throwAt(g, thrown.field);
    if (!e) break;
    add(e);
    darts++;
  }
  out.push({ type: 'game.ended', payload: { gameId, reason: 'finished' } });
  return out;
}

/** Sind beide Spieler Computer? Dann wird die Partie automatisch ausgespielt. */
export function isBotDuel(created: Pick<GameCreatedPayload, 'participants'>): boolean {
  return created.participants.length === 2 && created.participants.every((p) => p.kind === 'bot');
}

