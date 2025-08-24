/*---------------------------------------------------------------------------------------------
 * PauseController Unit Tests
 *--------------------------------------------------------------------------------------------*/

import { PauseController } from '../pauseController';
import { CancellationError } from '../types';

describe('PauseController', () => {
    let pauseController: PauseController;

    beforeEach(() => {
        pauseController = new PauseController();
    });

    afterEach(() => {
        pauseController.dispose();
    });

    describe('Basic State Management', () => {
        test('should start in active state', () => {
            expect(pauseController.isCancellationRequested).toBe(false);
            expect(pauseController.isPaused).toBe(false);
        });

        test('should transition to paused state', () => {
            pauseController.pause();
            expect(pauseController.isPaused).toBe(true);
        });

        test('should unpause from paused state', () => {
            pauseController.pause();
            pauseController.unpause();
            expect(pauseController.isPaused).toBe(false);
        });

        test('should handle cancellation', () => {
            pauseController.cancel();
            expect(pauseController.isCancellationRequested).toBe(true);
        });
    });

    describe('Async Operations', () => {
        test('should wait for unpause', async () => {
            pauseController.pause();

            const waitPromise = pauseController.waitForUnpause();
            
            // Unpause after short delay
            setTimeout(() => pauseController.unpause(), 50);

            await expect(waitPromise).resolves.toBeUndefined();
        });

        test('should throw on waitForUnpause when cancelled', async () => {
            pauseController.pause();
            pauseController.cancel();

            await expect(pauseController.waitForUnpause()).rejects.toThrow(CancellationError);
        });

        test('should check async state properly', async () => {
            expect(await pauseController.checkAsync()).toBe(false);
            
            pauseController.cancel();
            expect(await pauseController.checkAsync()).toBe(true);
        });

        test('should handle pause in checkAsync', async () => {
            pauseController.pause();
            
            const checkPromise = pauseController.checkAsync();
            setTimeout(() => pauseController.unpause(), 50);
            
            const result = await checkPromise;
            expect(result).toBe(false);
        });
    });

    describe('Timeout Operations', () => {
        test('should create timeout that respects pausing', async () => {
            const startTime = Date.now();
            
            pauseController.pause();
            const timeoutPromise = pauseController.createTimeout(100);
            
            // Unpause after 50ms
            setTimeout(() => pauseController.unpause(), 50);
            
            await timeoutPromise;
            const elapsed = Date.now() - startTime;
            
            // Should take at least 150ms (50ms pause + 100ms timeout)
            expect(elapsed).toBeGreaterThanOrEqual(140);
        });

        test('should cancel timeout on cancellation', async () => {
            const timeoutPromise = pauseController.createTimeout(100);
            pauseController.cancel();

            await expect(timeoutPromise).rejects.toThrow(CancellationError);
        });
    });

    describe('Event Handling', () => {
        test('should emit pause change events', () => {
            const listener = jest.fn();
            const disposable = pauseController.onDidChangePause(listener);

            pauseController.pause();
            expect(listener).toHaveBeenCalledWith(true);

            pauseController.unpause();
            expect(listener).toHaveBeenCalledWith(false);

            disposable.dispose();
        });

        test('should emit cancellation events', () => {
            const listener = jest.fn();
            pauseController.onCancellationRequested(listener);

            pauseController.cancel();
            expect(listener).toHaveBeenCalled();
        });
    });

    describe('Error Scenarios', () => {
        test('should handle multiple pause calls', () => {
            pauseController.pause();
            pauseController.pause();
            
            expect(pauseController.isPaused).toBe(true);
        });

        test('should handle unpause without pause', () => {
            expect(() => pauseController.unpause()).not.toThrow();
            expect(pauseController.isPaused).toBe(false);
        });

        test('should handle operations on disposed controller', () => {
            pauseController.dispose();

            expect(() => pauseController.pause()).not.toThrow();
            expect(() => pauseController.unpause()).not.toThrow();
            expect(() => pauseController.cancel()).not.toThrow();
        });
    });

    describe('Static Methods', () => {
        test('should combine multiple tokens', () => {
            const controller1 = new PauseController();
            const controller2 = new PauseController();
            
            controller1.cancel();
            
            const combined = PauseController.combine(controller1, controller2);
            
            expect(combined.isCancellationRequested).toBe(true);
            
            controller1.dispose();
            controller2.dispose();
            combined.dispose();
        });
    });

    describe('ExecuteWithPauseSupport', () => {
        test('should execute operation with pause support', async () => {
            const operation = jest.fn().mockResolvedValue('result');
            const onPause = jest.fn();
            const onUnpause = jest.fn();

            const result = await pauseController.executeWithPauseSupport(
                operation,
                onPause,
                onUnpause
            );

            expect(result).toBe('result');
            expect(operation).toHaveBeenCalled();
        });
    });
});