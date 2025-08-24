/*---------------------------------------------------------------------------------------------
 * PauseController Unit Tests
 *--------------------------------------------------------------------------------------------*/

import { PauseController, PauseState } from '../pauseController';

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
            expect(pauseController.currentState).toBe(PauseState.Active);
            expect(pauseController.isCancellationRequested).toBe(false);
            expect(pauseController.isPaused).toBe(false);
        });

        test('should transition to paused state', async () => {
            pauseController.pause();
            expect(pauseController.currentState).toBe(PauseState.Paused);
            expect(pauseController.isPaused).toBe(true);
        });

        test('should resume from paused state', async () => {
            pauseController.pause();
            pauseController.resume();
            expect(pauseController.currentState).toBe(PauseState.Active);
            expect(pauseController.isPaused).toBe(false);
        });

        test('should handle cancellation', async () => {
            pauseController.cancel();
            expect(pauseController.currentState).toBe(PauseState.Cancelled);
            expect(pauseController.isCancellationRequested).toBe(true);
        });
    });

    describe('Graceful Cancellation', () => {
        test('should initiate graceful cancellation', async () => {
            const cleanupPromise = new Promise<void>(resolve => {
                setTimeout(() => resolve(), 50);
            });

            const result = pauseController.gracefulCancel(100, () => cleanupPromise);
            expect(pauseController.currentState).toBe(PauseState.GracefulCancellation);

            await expect(result).resolves.toBe(true);
            expect(pauseController.currentState).toBe(PauseState.Cancelled);
        });

        test('should timeout graceful cancellation', async () => {
            const slowCleanup = new Promise<void>(resolve => {
                setTimeout(() => resolve(), 200);
            });

            const result = pauseController.gracefulCancel(50, () => slowCleanup);
            
            await expect(result).resolves.toBe(false);
            expect(pauseController.currentState).toBe(PauseState.ForceCancelled);
        });

        test('should handle cleanup errors during graceful cancellation', async () => {
            const failingCleanup = Promise.reject(new Error('Cleanup failed'));

            const result = pauseController.gracefulCancel(100, () => failingCleanup);
            
            await expect(result).resolves.toBe(false);
            expect(pauseController.currentState).toBe(PauseState.ForceCancelled);
        });
    });

    describe('Async Operations', () => {
        test('should handle pause during async operation', async () => {
            const longOperation = new Promise<string>(resolve => {
                setTimeout(() => resolve('completed'), 100);
            });

            // Start operation and pause immediately
            const operationPromise = pauseController.handleAsync(longOperation);
            pauseController.pause();

            // Resume after short delay
            setTimeout(() => pauseController.resume(), 50);

            const result = await operationPromise;
            expect(result).toBe('completed');
        });

        test('should reject async operation on cancellation', async () => {
            const longOperation = new Promise<string>(resolve => {
                setTimeout(() => resolve('completed'), 100);
            });

            const operationPromise = pauseController.handleAsync(longOperation);
            pauseController.cancel();

            await expect(operationPromise).rejects.toThrow('Operation was cancelled');
        });

        test('should wait for pause state to resolve', async () => {
            pauseController.pause();

            const waitPromise = pauseController.waitIfPaused();
            
            // Resume after short delay
            setTimeout(() => pauseController.resume(), 50);

            await expect(waitPromise).resolves.toBeUndefined();
        });
    });

    describe('Event Handling', () => {
        test('should emit pause events', () => {
            const pauseListener = jest.fn();
            const resumeListener = jest.fn();
            const cancelListener = jest.fn();

            pauseController.onDidPause(pauseListener);
            pauseController.onDidResume(resumeListener);
            pauseController.onDidCancel(cancelListener);

            pauseController.pause();
            expect(pauseListener).toHaveBeenCalledWith(PauseState.Paused);

            pauseController.resume();
            expect(resumeListener).toHaveBeenCalledWith(PauseState.Active);

            pauseController.cancel();
            expect(cancelListener).toHaveBeenCalledWith(PauseState.Cancelled);
        });

        test('should dispose event listeners properly', () => {
            const listener = jest.fn();
            const disposable = pauseController.onDidPause(listener);

            disposable.dispose();
            pauseController.pause();

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('Resource Management', () => {
        test('should register and clean up resources', () => {
            const cleanup1 = jest.fn();
            const cleanup2 = jest.fn();

            pauseController.registerCleanup(cleanup1);
            pauseController.registerCleanup(cleanup2);

            pauseController.dispose();

            expect(cleanup1).toHaveBeenCalled();
            expect(cleanup2).toHaveBeenCalled();
        });

        test('should handle cleanup errors gracefully', () => {
            const failingCleanup = jest.fn(() => {
                throw new Error('Cleanup error');
            });
            const successfulCleanup = jest.fn();

            pauseController.registerCleanup(failingCleanup);
            pauseController.registerCleanup(successfulCleanup);

            expect(() => pauseController.dispose()).not.toThrow();
            expect(failingCleanup).toHaveBeenCalled();
            expect(successfulCleanup).toHaveBeenCalled();
        });
    });

    describe('Error Scenarios', () => {
        test('should handle multiple pause calls', () => {
            pauseController.pause();
            pauseController.pause();
            
            expect(pauseController.currentState).toBe(PauseState.Paused);
        });

        test('should handle resume without pause', () => {
            expect(() => pauseController.resume()).not.toThrow();
            expect(pauseController.currentState).toBe(PauseState.Active);
        });

        test('should handle operations on disposed controller', () => {
            pauseController.dispose();

            expect(() => pauseController.pause()).not.toThrow();
            expect(() => pauseController.resume()).not.toThrow();
            expect(() => pauseController.cancel()).not.toThrow();
        });
    });

    describe('Integration Scenarios', () => {
        test('should handle complex state transitions', async () => {
            // Start with active
            expect(pauseController.currentState).toBe(PauseState.Active);

            // Pause
            pauseController.pause();
            expect(pauseController.currentState).toBe(PauseState.Paused);

            // Resume
            pauseController.resume();
            expect(pauseController.currentState).toBe(PauseState.Active);

            // Graceful cancel
            const cleanupPromise = Promise.resolve();
            const gracefulResult = pauseController.gracefulCancel(100, () => cleanupPromise);
            expect(pauseController.currentState).toBe(PauseState.GracefulCancellation);

            await gracefulResult;
            expect(pauseController.currentState).toBe(PauseState.Cancelled);
        });
    });
});