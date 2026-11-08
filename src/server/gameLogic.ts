import crypto from 'crypto';
import { Player, Role, EVIL_ROLES } from '../utils/sharedTypes';

export function getQuestConfig(playerCount: number) {
  const configs: Record<number, { sizes: number[], twoFails: boolean[] }> = {
    5: { sizes: [2, 3, 2, 3, 3], twoFails: [false, false, false, false, false] },
    6: { sizes: [2, 3, 4, 3, 4], twoFails: [false, false, false, false, false] },
    7: { sizes: [2, 3, 3, 4, 4], twoFails: [false, false, false, true, false] },
    8: { sizes: [3, 4, 4, 5, 5], twoFails: [false, false, false, true, false] },
    9: { sizes: [3, 4, 4, 5, 5], twoFails: [false, false, false, true, false] },
    10: { sizes: [3, 4, 4, 5, 5], twoFails: [false, false, false, true, false] },
  };
  return configs[playerCount] || configs[5];
}

export function assignRoles(players: Player[], requestedRoles?: Record<string, Role>) {
  const count = players.length;
  let roles: Role[] = [];

  switch (count) {
    case 5:
      roles = ['Merlin', 'Percival', 'Loyal Servant', 'Morgana', 'Assassin'];
      break;
    case 6:
      roles = ['Merlin', 'Percival', 'Loyal Servant', 'Loyal Servant', 'Morgana', 'Assassin'];
      break;
    case 7:
      roles = ['Merlin', 'Percival', 'Loyal Servant', 'Loyal Servant', 'Morgana', 'Assassin', 'Oberon'];
      break;
    case 8:
      roles = ['Merlin', 'Percival', 'Loyal Servant', 'Loyal Servant', 'Loyal Servant', 'Morgana', 'Assassin', 'Minion'];
      break;
    case 9:
      roles = ['Merlin', 'Percival', 'Loyal Servant', 'Loyal Servant', 'Loyal Servant', 'Loyal Servant', 'Morgana', 'Assassin', 'Mordred'];
      break;
    case 10:
      roles = ['Merlin', 'Percival', 'Loyal Servant', 'Loyal Servant', 'Loyal Servant', 'Loyal Servant', 'Morgana', 'Assassin', 'Oberon', 'Mordred'];
      break;
    default:
      roles = ['Merlin', 'Percival', 'Loyal Servant', 'Morgana', 'Assassin']; // Fallback
  }

  // Handle Forced/Requested Roles (Dev Mode testing)
  if (requestedRoles) {
    Object.entries(requestedRoles).forEach(([sessionId, desiredRole]) => {
      // Find the player 
      const playerIndex = players.findIndex(p => p.sessionId === sessionId);
      if (playerIndex !== -1 && desiredRole) {

        // Is the desired role in the current available pool?
        const roleIndexInPool = roles.indexOf(desiredRole);

        if (roleIndexInPool !== -1) {
          // Yes: just remove it from the pool so we don't assign it again
          roles.splice(roleIndexInPool, 1);
        } else {
          // No: Forced to swap. We need to maintain alignment balance.
          const isEvil = EVIL_ROLES.has(desiredRole);

          if (isEvil) {
            // Find another evil role to remove
            const evilIndex = roles.findIndex(r => EVIL_ROLES.has(r));
            if (evilIndex !== -1) {
              roles.splice(evilIndex, 1);
            } else {
              roles.pop(); // Fallback if something is weird
            }
          } else {
            // Find another good role to remove
            const goodIndex = roles.findIndex(r => ['Merlin', 'Percival', 'Loyal Servant'].includes(r));
            if (goodIndex !== -1) {
              roles.splice(goodIndex, 1);
            } else {
              roles.pop();
            }
          }
        }

        // Actually assign it
        players[playerIndex].role = desiredRole;
      }
    });
  }

  // Shuffle players and remaining roles
  shuffle(players);
  shuffle(roles);

  // Assign remaining roles
  for (const p of players) {
    if (p.role) continue;

    p.role = roles.pop();
    if (!p.role) {
      throw new Error('Not enough roles to assign to all players');
    }
  }
}

/**
 * Generates a secure random number between 0 and 1.
 * 
 * This function is for server-side use only because it depends on Node.js `crypto` lib.
 */
export function generateSecureRandomNumber(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] * Math.pow(2, -32);
}

function shuffle<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(generateSecureRandomNumber() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export interface LoneHumanEvilStatus {
  isLoneHumanEvil: boolean;
  chooserSessionId?: string;
  currentRole?: Role;
  availableRoles: Role[];
}

export function getLoneHumanEvilStatus(players: Player[]): LoneHumanEvilStatus {
  const evilPlayers = players.filter(p => p.role && EVIL_ROLES.has(p.role));
  const humanEvils = evilPlayers.filter(p => !p.isBot);
  const botEvils = evilPlayers.filter(p => p.isBot);

  if (humanEvils.length === 1 && botEvils.length > 0) {
    const human = humanEvils[0];
    const availableRoles = Array.from(new Set(evilPlayers.map(p => p.role!).filter(Boolean)));
    return {
      isLoneHumanEvil: true,
      chooserSessionId: human.sessionId,
      currentRole: human.role,
      availableRoles,
    };
  }

  return {
    isLoneHumanEvil: false,
    availableRoles: [],
  };
}

export function swapEvilRole(players: Player[], humanSessionId: string, targetRole: Role): boolean {
  if (!EVIL_ROLES.has(targetRole)) {
    return false;
  }

  const human = players.find(p => p.sessionId === humanSessionId && !p.isBot);
  if (!human || !human.role || !EVIL_ROLES.has(human.role)) {
    return false;
  }

  // Already has this role - no-op success (stay with current role)
  if (human.role === targetRole) {
    return true;
  }

  // Find the bot on the evil team holding targetRole
  const bot = players.find(p => p.isBot && p.role === targetRole);
  if (!bot) {
    return false;
  }

  // Swap roles
  const previousRole = human.role;
  human.role = targetRole;
  bot.role = previousRole;
  return true;
}
