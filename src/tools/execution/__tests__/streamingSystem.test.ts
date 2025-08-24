/*---------------------------------------------------------------------------------------------
 * Streaming System Unit Tests
 *--------------------------------------------------------------------------------------------*/

import { 
    CircularStreamBuffer, 
    ResponsiveChatResponseStream, 
    StreamProcessor,
    StreamFactory,
    StreamEventType
} from '../streamingSystem';
import { PauseController } from '../pauseController';
import { ChatFetchResponseType, Raw } from '../types';

describe('CircularStreamBuffer', () => {
    let buffer: CircularStreamBuffer<string>;

    beforeEach(() => {
        buffer = new CircularStreamBuffer<string>(3);
    });

    test('should add and retrieve items in order', () => {
        buffer.add('item1');
        buffer.add('item2');
        buffer.add('item3');

        const items = buffer.getAll();
        expect(items).toEqual(['item1', 'item2', 'item3']);
    });

    test('should handle circular overflow', () => {
        buffer.add('item1');
        buffer.add('item2');
        buffer.add('item3');
        buffer.add('item4'); // Should overwrite item1

        const items = buffer.getAll();
        expect(items).toEqual(['item2', 'item3', 'item4']);
        expect(buffer.size()).toBe(3);
    });

    test('should handle clear operation', () => {
        buffer.add('item1');
        buffer.add('item2');
        buffer.clear();

        expect(buffer.size()).toBe(0);
        expect(buffer.getAll()).toEqual([]);
    });

    test('should handle peek operations', () => {
        buffer.add('item1');
        buffer.add('item2');

        expect(buffer.peek()).toBe('item2'); // Latest item
        expect(buffer.size()).toBe(2); // Size unchanged
    });
});

describe('ResponsiveChatResponseStream', () => {
    let stream: ResponsiveChatResponseStream;
    let pauseController: PauseController;

    beforeEach(() => {
        pauseController = new PauseController();
        stream = new ResponsiveChatResponseStream(pauseController, { bufferSize: 5 });
    });

    afterEach(() => {
        stream.dispose();
        pauseController.dispose();
    });

    describe('Basic Operations', () => {
        test('should initialize with correct state', () => {
            expect(stream.isStreaming).toBe(false);
            expect(stream.isPaused).toBe(false);
        });

        test('should start and stop streaming', async () => {
            const mockResponse = {
                type: ChatFetchResponseType.Success,
                value: {
                    role: Raw.ChatRole.Assistant,
                    content: 'Test response',
                    toolCalls: []
                }
            };

            const streamPromise = stream.startStreaming(async function* () {
                yield mockResponse;
            });

            expect(stream.isStreaming).toBe(true);

            const result = await streamPromise;
            expect(result.responses).toHaveLength(1);
            expect(result.responses[0]).toEqual(mockResponse);
            expect(stream.isStreaming).toBe(false);
        });

        test('should handle pause and resume', async () => {
            const responses = [
                { type: ChatFetchResponseType.Success, value: { role: Raw.ChatRole.Assistant, content: 'Response 1', toolCalls: [] }},
                { type: ChatFetchResponseType.Success, value: { role: Raw.ChatRole.Assistant, content: 'Response 2', toolCalls: [] }}
            ];

            let responseIndex = 0;
            const streamPromise = stream.startStreaming(async function* () {
                while (responseIndex < responses.length) {
                    yield responses[responseIndex++];
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            });

            // Pause after starting
            setTimeout(() => {
                pauseController.pause();
                expect(stream.isPaused).toBe(true);
            }, 25);

            // Resume after pause
            setTimeout(() => {
                pauseController.resume();
                expect(stream.isPaused).toBe(false);
            }, 100);

            const result = await streamPromise;
            expect(result.responses).toHaveLength(2);
        });
    });

    describe('Event Handling', () => {
        test('should emit stream events', async () => {
            const startListener = jest.fn();
            const dataListener = jest.fn();
            const endListener = jest.fn();

            stream.onStreamEvent(StreamEventType.StreamStart, startListener);
            stream.onStreamEvent(StreamEventType.DataReceived, dataListener);
            stream.onStreamEvent(StreamEventType.StreamEnd, endListener);

            const mockResponse = {
                type: ChatFetchResponseType.Success,
                value: { role: Raw.ChatRole.Assistant, content: 'Test', toolCalls: [] }
            };

            await stream.startStreaming(async function* () {
                yield mockResponse;
            });

            expect(startListener).toHaveBeenCalled();
            expect(dataListener).toHaveBeenCalledWith(mockResponse);
            expect(endListener).toHaveBeenCalled();
        });

        test('should emit pause and resume events', () => {
            const pauseListener = jest.fn();
            const resumeListener = jest.fn();

            stream.onStreamEvent(StreamEventType.StreamPaused, pauseListener);
            stream.onStreamEvent(StreamEventType.StreamResumed, resumeListener);

            pauseController.pause();
            expect(pauseListener).toHaveBeenCalled();

            pauseController.resume();
            expect(resumeListener).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle generator errors', async () => {
            const errorListener = jest.fn();
            stream.onStreamEvent(StreamEventType.StreamError, errorListener);

            const streamPromise = stream.startStreaming(async function* () {
                throw new Error('Generator error');
            });

            await expect(streamPromise).rejects.toThrow('Generator error');
            expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
        });

        test('should handle cancellation during streaming', async () => {
            const streamPromise = stream.startStreaming(async function* () {
                while (true) {
                    yield { type: ChatFetchResponseType.Success, value: { role: Raw.ChatRole.Assistant, content: 'Test', toolCalls: [] }};
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            });

            setTimeout(() => pauseController.cancel(), 25);

            await expect(streamPromise).rejects.toThrow('Stream was cancelled');
        });
    });

    describe('Metrics', () => {
        test('should collect basic metrics', async () => {
            const mockResponse = {
                type: ChatFetchResponseType.Success,
                value: { role: Raw.ChatRole.Assistant, content: 'Test response', toolCalls: [] }
            };

            await stream.startStreaming(async function* () {
                yield mockResponse;
                yield mockResponse;
            });

            const metrics = stream.getMetrics();
            expect(metrics.totalResponses).toBe(2);
            expect(metrics.totalDuration).toBeGreaterThan(0);
            expect(metrics.averageResponseTime).toBeGreaterThan(0);
        });
    });
});

describe('StreamProcessor', () => {
    test('should process stream responses', async () => {
        const processor = new StreamProcessor({
            onData: jest.fn(),
            onError: jest.fn(),
            onComplete: jest.fn()
        });

        const responses = [
            { type: ChatFetchResponseType.Success, value: { role: Raw.ChatRole.Assistant, content: 'Response 1', toolCalls: [] }},
            { type: ChatFetchResponseType.Success, value: { role: Raw.ChatRole.Assistant, content: 'Response 2', toolCalls: [] }}
        ];

        const result = await processor.processStream(async function* () {
            for (const response of responses) {
                yield response;
            }
        });

        expect(result.processedCount).toBe(2);
        expect(result.errors).toHaveLength(0);
    });

    test('should handle processing errors', async () => {
        const processor = new StreamProcessor({
            onData: () => { throw new Error('Processing error'); },
            onError: jest.fn(),
            onComplete: jest.fn()
        });

        const result = await processor.processStream(async function* () {
            yield { type: ChatFetchResponseType.Success, value: { role: Raw.ChatRole.Assistant, content: 'Test', toolCalls: [] }};
        });

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toBe('Processing error');
    });
});

describe('StreamFactory', () => {
    let pauseController: PauseController;

    beforeEach(() => {
        pauseController = new PauseController();
    });

    afterEach(() => {
        pauseController.dispose();
    });

    test('should create responsive stream', () => {
        const stream = StreamFactory.createResponsiveStream(pauseController);
        expect(stream).toBeInstanceOf(ResponsiveChatResponseStream);
        stream.dispose();
    });

    test('should create processor stream', () => {
        const processor = StreamFactory.createProcessorStream({
            onData: jest.fn(),
            onError: jest.fn(),
            onComplete: jest.fn()
        });
        expect(processor).toBeInstanceOf(StreamProcessor);
    });

    test('should create high performance stream', () => {
        const stream = StreamFactory.createHighPerformanceStream(pauseController, {
            bufferSize: 1000,
            batchSize: 50
        });
        expect(stream).toBeInstanceOf(ResponsiveChatResponseStream);
        stream.dispose();
    });

    test('should create debug stream', () => {
        const stream = StreamFactory.createDebugStream(pauseController);
        expect(stream).toBeInstanceOf(ResponsiveChatResponseStream);
        stream.dispose();
    });
});