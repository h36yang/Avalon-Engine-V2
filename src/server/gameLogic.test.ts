import { describe, it, expect } from 'vitest';
import { Player, Role } from '../utils/sharedTypes';
import { getQuestConfig, assignRoles, getLoneHumanEvilStatus, swapEvilRole } from './gameLogic';

describe('gameLogic', () => {
    describe('getQuestConfig', () => {
        it('returns correct config for 5 players', () => {
            const config = getQuestConfig(5);
            expect(config.sizes).toEqual([2, 3, 2, 3, 3]);
            expect(config.twoFails).toEqual([false, false, false, false, false]);
        });

        it('returns correct config for 7 players with 2-fails required on 4th quest', () => {
            const config = getQuestConfig(7);
            expect(config.sizes).toEqual([2, 3, 3, 4, 4]);
            expect(config.twoFails).toEqual([false, false, false, true, false]);
        });

        it('falls back to 5 players config for unknown counts', () => {
            const config = getQuestConfig(2);
            expect(config.sizes).toEqual([2, 3, 2, 3, 3]);
        });
    });

    describe('assignRoles', () => {
        it.each(
            [5, 6, 7, 8, 9, 10]
        )('assigns correct number of roles for %i players', (playerCount) => {
            const players: Player[] = Array.from({ length: playerCount }, (_, i) => ({
                id: `id_${i}`,
                sessionId: `session_${i}`,
                name: `Player ${i}`,
                isConnected: true,
                isHost: i === 0,
            }));

            assignRoles(players);

            // Ensure all players have a role
            expect(players.every(p => !!p.role)).toBe(true);
        });

        it('assigns 5 players correctly with core roles', () => {
            const players: Player[] = Array.from({ length: 5 }, (_, i) => ({
                id: `id_${i}`,
                sessionId: `session_${i}`,
                name: `Player ${i}`,
                isConnected: true,
                isHost: i === 0,
            }));

            assignRoles(players);

            const assignedRoles = players.map(p => p.role);
            expect(assignedRoles).toContain('Merlin');
            expect(assignedRoles).toContain('Assassin');
            expect(assignedRoles).toContain('Percival');
            expect(assignedRoles).toContain('Morgana');
            expect(assignedRoles).toContain('Loyal Servant');
        });

        it('assigns 10 players correctly', () => {
            const players: Player[] = Array.from({ length: 10 }, (_, i) => ({
                id: `id_${i}`,
                sessionId: `session_${i}`,
                name: `Player ${i}`,
                isConnected: true,
                isHost: i === 0,
            }));

            assignRoles(players);

            const assignedRoles = players.map(p => p.role);
            expect(assignedRoles.filter(r => r === 'Loyal Servant').length).toBe(4);
            expect(assignedRoles).toContain('Oberon');
            expect(assignedRoles).toContain('Mordred');
        });

        it('respects developer forced roles and maintains balance when swapping', () => {
            const players: Player[] = Array.from({ length: 5 }, (_, i) => ({
                id: `id_${i}`,
                sessionId: `session_${i}`,
                name: `Player ${i}`,
                isConnected: true,
                isHost: i === 0,
            }));

            // Force session_0 to be Mordred (who isn't normally in a 5 player game)
            // Force session_1 to be Assassin.
            const requestedRoles: Record<string, Role> = {
                'session_0': 'Mordred',
                'session_1': 'Assassin'
            };

            assignRoles(players, requestedRoles);

            expect(players.find(p => p.sessionId === 'session_0')?.role).toBe('Mordred');
            expect(players.find(p => p.sessionId === 'session_1')?.role).toBe('Assassin');

            const assignedRoles = players.map(p => p.role);

            // Should have perfectly replaced an evil role (Assassin was requested, 5-player pool only has 2 evils: Assassin & Morgana)
            // So if we force Mordred, Morgana must have been removed to make room, maintaining 3 Good / 2 Evil.
            expect(assignedRoles.filter(r => r === 'Mordred').length).toBe(1);
            expect(assignedRoles.filter(r => r === 'Assassin').length).toBe(1);
            expect(assignedRoles.filter(r => r === 'Morgana').length).toBe(0); // Morgana got swapped out

            // Remaining 3 should be good
            expect(assignedRoles.filter(r => ['Merlin', 'Percival', 'Loyal Servant'].includes(r as string)).length).toBe(3);
        });
    });

    describe('getLoneHumanEvilStatus', () => {
        it('returns isLoneHumanEvil true when evil has exactly 1 human and 1 bot in 5-player', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human 1', isConnected: true, isHost: true, isBot: false, role: 'Morgana' },
                { id: '2', sessionId: 's2', name: 'Bot 1', isConnected: true, isHost: false, isBot: true, role: 'Assassin' },
                { id: '3', sessionId: 's3', name: 'Bot 2', isConnected: true, isHost: false, isBot: true, role: 'Merlin' },
                { id: '4', sessionId: 's4', name: 'Bot 3', isConnected: true, isHost: false, isBot: true, role: 'Percival' },
                { id: '5', sessionId: 's5', name: 'Bot 4', isConnected: true, isHost: false, isBot: true, role: 'Loyal Servant' },
            ];

            const status = getLoneHumanEvilStatus(players);
            expect(status.isLoneHumanEvil).toBe(true);
            expect(status.chooserSessionId).toBe('s1');
            expect(status.currentRole).toBe('Morgana');
            expect(status.availableRoles).toEqual(expect.arrayContaining(['Morgana', 'Assassin']));
        });

        it('returns isLoneHumanEvil true for 7-player game with 1 human evil and 2 bot evils', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Good', isConnected: true, isHost: true, isBot: false, role: 'Merlin' },
                { id: '2', sessionId: 's2', name: 'Human Evil', isConnected: true, isHost: false, isBot: false, role: 'Oberon' },
                { id: '3', sessionId: 's3', name: 'Bot Evil 1', isConnected: true, isHost: false, isBot: true, role: 'Morgana' },
                { id: '4', sessionId: 's4', name: 'Bot Evil 2', isConnected: true, isHost: false, isBot: true, role: 'Assassin' },
                { id: '5', sessionId: 's5', name: 'Bot Good 1', isConnected: true, isHost: false, isBot: true, role: 'Percival' },
                { id: '6', sessionId: 's6', name: 'Bot Good 2', isConnected: true, isHost: false, isBot: true, role: 'Loyal Servant' },
                { id: '7', sessionId: 's7', name: 'Bot Good 3', isConnected: true, isHost: false, isBot: true, role: 'Loyal Servant' },
            ];

            const status = getLoneHumanEvilStatus(players);
            expect(status.isLoneHumanEvil).toBe(true);
            expect(status.chooserSessionId).toBe('s2');
            expect(status.currentRole).toBe('Oberon');
            expect(status.availableRoles).toEqual(expect.arrayContaining(['Oberon', 'Morgana', 'Assassin']));
        });

        it('returns isLoneHumanEvil false when evil has 2 human players', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Evil 1', isConnected: true, isHost: true, isBot: false, role: 'Morgana' },
                { id: '2', sessionId: 's2', name: 'Human Evil 2', isConnected: true, isHost: false, isBot: false, role: 'Assassin' },
                { id: '3', sessionId: 's3', name: 'Bot 1', isConnected: true, isHost: false, isBot: true, role: 'Merlin' },
                { id: '4', sessionId: 's4', name: 'Bot 2', isConnected: true, isHost: false, isBot: true, role: 'Percival' },
                { id: '5', sessionId: 's5', name: 'Bot 3', isConnected: true, isHost: false, isBot: true, role: 'Loyal Servant' },
            ];

            const status = getLoneHumanEvilStatus(players);
            expect(status.isLoneHumanEvil).toBe(false);
            expect(status.availableRoles).toEqual([]);
        });

        it('returns isLoneHumanEvil false when all evil players are bots', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Good 1', isConnected: true, isHost: true, isBot: false, role: 'Merlin' },
                { id: '2', sessionId: 's2', name: 'Human Good 2', isConnected: true, isHost: false, isBot: false, role: 'Percival' },
                { id: '3', sessionId: 's3', name: 'Bot Evil 1', isConnected: true, isHost: false, isBot: true, role: 'Morgana' },
                { id: '4', sessionId: 's4', name: 'Bot Evil 2', isConnected: true, isHost: false, isBot: true, role: 'Assassin' },
                { id: '5', sessionId: 's5', name: 'Bot Good', isConnected: true, isHost: false, isBot: true, role: 'Loyal Servant' },
            ];

            const status = getLoneHumanEvilStatus(players);
            expect(status.isLoneHumanEvil).toBe(false);
        });

        it('returns isLoneHumanEvil false when all players are human', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'H1', isConnected: true, isHost: true, isBot: false, role: 'Merlin' },
                { id: '2', sessionId: 's2', name: 'H2', isConnected: true, isHost: false, isBot: false, role: 'Percival' },
                { id: '3', sessionId: 's3', name: 'H3', isConnected: true, isHost: false, isBot: false, role: 'Loyal Servant' },
                { id: '4', sessionId: 's4', name: 'H4', isConnected: true, isHost: false, isBot: false, role: 'Morgana' },
                { id: '5', sessionId: 's5', name: 'H5', isConnected: true, isHost: false, isBot: false, role: 'Assassin' },
            ];

            const status = getLoneHumanEvilStatus(players);
            expect(status.isLoneHumanEvil).toBe(false);
        });
    });

    describe('swapEvilRole', () => {
        it('swaps role with the bot holding the target role', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Evil', isConnected: true, isHost: true, isBot: false, role: 'Morgana' },
                { id: '2', sessionId: 's2', name: 'Bot Evil', isConnected: true, isHost: false, isBot: true, role: 'Assassin' },
                { id: '3', sessionId: 's3', name: 'Bot Good', isConnected: true, isHost: false, isBot: true, role: 'Merlin' },
            ];

            const success = swapEvilRole(players, 's1', 'Assassin');
            expect(success).toBe(true);
            expect(players.find(p => p.sessionId === 's1')?.role).toBe('Assassin');
            expect(players.find(p => p.sessionId === 's2')?.role).toBe('Morgana');
        });

        it('allows swapping back to original role', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Evil', isConnected: true, isHost: true, isBot: false, role: 'Morgana' },
                { id: '2', sessionId: 's2', name: 'Bot Evil', isConnected: true, isHost: false, isBot: true, role: 'Assassin' },
            ];

            swapEvilRole(players, 's1', 'Assassin');
            expect(players.find(p => p.sessionId === 's1')?.role).toBe('Assassin');

            const swappedBack = swapEvilRole(players, 's1', 'Morgana');
            expect(swappedBack).toBe(true);
            expect(players.find(p => p.sessionId === 's1')?.role).toBe('Morgana');
            expect(players.find(p => p.sessionId === 's2')?.role).toBe('Assassin');
        });

        it('returns true when selecting current role (stay with current role)', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Evil', isConnected: true, isHost: true, isBot: false, role: 'Morgana' },
                { id: '2', sessionId: 's2', name: 'Bot Evil', isConnected: true, isHost: false, isBot: true, role: 'Assassin' },
            ];

            const success = swapEvilRole(players, 's1', 'Morgana');
            expect(success).toBe(true);
            expect(players.find(p => p.sessionId === 's1')?.role).toBe('Morgana');
            expect(players.find(p => p.sessionId === 's2')?.role).toBe('Assassin');
        });

        it('rejects swapping to a non-evil role', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Evil', isConnected: true, isHost: true, isBot: false, role: 'Morgana' },
                { id: '2', sessionId: 's2', name: 'Bot Good', isConnected: true, isHost: false, isBot: true, role: 'Merlin' },
            ];

            const success = swapEvilRole(players, 's1', 'Merlin');
            expect(success).toBe(false);
            expect(players.find(p => p.sessionId === 's1')?.role).toBe('Morgana');
        });

        it('rejects swap requests from good players or bots', () => {
            const players: Player[] = [
                { id: '1', sessionId: 's1', name: 'Human Good', isConnected: true, isHost: true, isBot: false, role: 'Merlin' },
                { id: '2', sessionId: 's2', name: 'Bot Evil', isConnected: true, isHost: false, isBot: true, role: 'Assassin' },
            ];

            expect(swapEvilRole(players, 's1', 'Assassin')).toBe(false);
            expect(swapEvilRole(players, 's2', 'Morgana')).toBe(false); // bot cannot call swap
        });
    });
});
