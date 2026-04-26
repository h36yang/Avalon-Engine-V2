import { describe, it, expect } from 'vitest';
import { getQuestConfig, assignRoles, Player } from './gameLogic';

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

            assignRoles(players, []);

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

            assignRoles(players, []);

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

            assignRoles(players, []);

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
            const requestedRoles = {
                'session_0': 'Mordred',
                'session_1': 'Assassin'
            } as any;

            assignRoles(players, [], requestedRoles);

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
});
