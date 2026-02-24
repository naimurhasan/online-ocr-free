const { isOpenRouterEngine, OPENROUTER_MODELS } = require('../../src/services/engines/openRouter');

describe('openRouter engine helpers', () => {
    describe('isOpenRouterEngine', () => {
        test('returns true for known OpenRouter engines', () => {
            expect(isOpenRouterEngine('gemma-openrouter-free')).toBe(true);
            expect(isOpenRouterEngine('gemma-openrouter-paid')).toBe(true);
            expect(isOpenRouterEngine('mistral-openrouter-free')).toBe(true);
            expect(isOpenRouterEngine('mistral-openrouter-paid')).toBe(true);
        });

        test('returns true for openrouter-custom', () => {
            expect(isOpenRouterEngine('openrouter-custom')).toBe(true);
        });

        test('returns false for non-OpenRouter engines', () => {
            expect(isOpenRouterEngine('tesseract')).toBe(false);
            expect(isOpenRouterEngine('google-vision')).toBe(false);
            expect(isOpenRouterEngine('')).toBe(false);
            expect(isOpenRouterEngine('random')).toBe(false);
        });
    });

    describe('OPENROUTER_MODELS', () => {
        test('contains expected model mappings', () => {
            expect(OPENROUTER_MODELS['gemma-openrouter-free']).toBe('google/gemma-3-27b-it:free');
            expect(OPENROUTER_MODELS['gemma-openrouter-paid']).toBe('google/gemma-3-27b-it');
            expect(OPENROUTER_MODELS['mistral-openrouter-free']).toBe('mistralai/mistral-small-3.1-24b-instruct:free');
            expect(OPENROUTER_MODELS['mistral-openrouter-paid']).toBe('mistralai/mistral-small-3.1-24b-instruct');
        });

        test('has exactly 4 models', () => {
            expect(Object.keys(OPENROUTER_MODELS)).toHaveLength(4);
        });
    });
});

describe('tesseract engine', () => {
    beforeEach(() => jest.resetModules());

    test('validateLanguages throws for missing traineddata', async () => {
        jest.doMock('tesseract.js', () => ({ recognize: jest.fn(), PSM: { AUTO: 3 } }));
        jest.doMock('fs', () => ({
            promises: {
                access: jest.fn().mockRejectedValue(new Error('ENOENT'))
            }
        }));

        const { validateLanguages } = require('../../src/services/engines/tesseract');
        await expect(validateLanguages('xyz')).rejects.toThrow('Missing Tesseract language data: xyz.traineddata');
    });

    test('validateLanguages handles multi-language codes', async () => {
        jest.doMock('tesseract.js', () => ({ recognize: jest.fn(), PSM: { AUTO: 3 } }));
        jest.doMock('fs', () => ({
            promises: {
                access: jest.fn().mockRejectedValue(new Error('ENOENT'))
            }
        }));

        const { validateLanguages } = require('../../src/services/engines/tesseract');
        await expect(validateLanguages('eng+ben')).rejects.toThrow('eng.traineddata, ben.traineddata');
    });

    test('validateLanguages deduplicates language codes', async () => {
        let accessCount = 0;
        jest.doMock('tesseract.js', () => ({ recognize: jest.fn(), PSM: { AUTO: 3 } }));
        jest.doMock('fs', () => ({
            promises: {
                access: jest.fn().mockImplementation(() => {
                    accessCount++;
                    return Promise.reject(new Error('ENOENT'));
                })
            }
        }));

        const { validateLanguages } = require('../../src/services/engines/tesseract');
        await expect(validateLanguages('ben+ben')).rejects.toThrow();
        expect(accessCount).toBe(1);
    });

    test('recognize calls Tesseract.recognize and returns text', async () => {
        const mockRecognize = jest.fn().mockResolvedValue({ data: { text: 'hello world' } });
        jest.doMock('tesseract.js', () => ({
            recognize: mockRecognize,
            PSM: { AUTO: 3 }
        }));
        jest.doMock('fs', () => ({
            promises: { access: jest.fn().mockResolvedValue(undefined) }
        }));

        const { recognize } = require('../../src/services/engines/tesseract');
        const result = await recognize('/tmp/test.png', 'eng');

        expect(mockRecognize).toHaveBeenCalledWith('/tmp/test.png', 'eng', expect.objectContaining({
            tessedit_pageseg_mode: 3,
            preserve_interword_spaces: '1'
        }));
        expect(result).toBe('hello world');
    });
});

describe('googleVision engine', () => {
    beforeEach(() => jest.resetModules());

    test('extractText throws when no API key provided', async () => {
        const { extractText } = require('../../src/services/engines/googleVision');
        await expect(extractText('/tmp/img.png', 'ben', '')).rejects.toThrow('Google Vision API key is required');
        await expect(extractText('/tmp/img.png', 'ben', null)).rejects.toThrow('Google Vision API key is required');
    });
});

describe('openRouter extractText', () => {
    beforeEach(() => jest.resetModules());

    test('throws when no API key provided', async () => {
        const originalEnv = process.env.OPENROUTER_API_KEY;
        delete process.env.OPENROUTER_API_KEY;

        const { extractText } = require('../../src/services/engines/openRouter');
        await expect(extractText('/tmp/img.png', 'image/png', 'ben', '', 'plain', 'gemma-openrouter-free'))
            .rejects.toThrow('OpenRouter API key is required');

        process.env.OPENROUTER_API_KEY = originalEnv;
    });

    test('strips Bearer prefix from API key', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: 'extracted text' } }]
            })
        });
        global.fetch = mockFetch;

        jest.doMock('fs', () => ({
            promises: {
                readFile: jest.fn().mockResolvedValue(Buffer.from('fake-image'))
            }
        }));

        const { extractText } = require('../../src/services/engines/openRouter');
        await extractText('/tmp/img.png', 'image/png', 'ben', 'Bearer sk-test-key', 'plain', 'gemma-openrouter-free');

        const callArgs = mockFetch.mock.calls[0][1];
        expect(callArgs.headers['Authorization']).toBe('Bearer sk-test-key');
    });

    test('truncates custom prompt to 2000 chars', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: 'text' } }]
            })
        });
        global.fetch = mockFetch;

        jest.doMock('fs', () => ({
            promises: {
                readFile: jest.fn().mockResolvedValue(Buffer.from('img'))
            }
        }));

        const { extractText } = require('../../src/services/engines/openRouter');
        const longPrompt = 'x'.repeat(3000);
        await extractText('/tmp/img.png', 'image/png', 'ben', 'sk-key', 'plain', 'gemma-openrouter-free', '', longPrompt);

        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        const sentPrompt = body.messages[0].content[0].text;
        expect(sentPrompt.length).toBeLessThanOrEqual(2000);
    });

    test('handles array content in response', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{ message: { content: [{ text: 'part1' }, { text: 'part2' }] } }]
            })
        });
        global.fetch = mockFetch;

        jest.doMock('fs', () => ({
            promises: {
                readFile: jest.fn().mockResolvedValue(Buffer.from('img'))
            }
        }));

        const { extractText } = require('../../src/services/engines/openRouter');
        const result = await extractText('/tmp/img.png', 'image/png', 'ben', 'sk-key', 'plain', 'gemma-openrouter-free');

        expect(result).toBe('part1\npart2');
    });

    test('throws on HTTP error with error message', async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ error: { message: 'Unauthorized' } })
        });
        global.fetch = mockFetch;

        jest.doMock('fs', () => ({
            promises: {
                readFile: jest.fn().mockResolvedValue(Buffer.from('img'))
            }
        }));

        const { extractText } = require('../../src/services/engines/openRouter');
        await expect(extractText('/tmp/img.png', 'image/png', 'ben', 'sk-key', 'plain', 'gemma-openrouter-free'))
            .rejects.toThrow('Unauthorized');
    });
});
