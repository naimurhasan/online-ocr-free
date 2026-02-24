const path = require('path');

jest.mock('sharp', () => {
    const mockSharp = {
        grayscale: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        blur: jest.fn().mockReturnThis(),
        threshold: jest.fn().mockReturnThis(),
        median: jest.fn().mockReturnThis(),
        linear: jest.fn().mockReturnThis(),
        toFile: jest.fn().mockResolvedValue({})
    };
    return jest.fn(() => mockSharp);
});

jest.mock('fs', () => ({
    promises: {
        access: jest.fn().mockResolvedValue(undefined),
        mkdir: jest.fn().mockResolvedValue(undefined),
        readdir: jest.fn().mockResolvedValue([]),
        unlink: jest.fn().mockResolvedValue(undefined)
    }
}));

const sharp = require('sharp');
const fs = require('fs').promises;

describe('preprocessing', () => {
    const { preprocessImageWithSteps, advancedPreprocessWithSteps, clearTempFolder } = require('../../src/services/preprocessing');

    afterEach(() => jest.clearAllMocks());

    describe('preprocessImageWithSteps', () => {
        test('creates original copy and processed output', async () => {
            const result = await preprocessImageWithSteps('/tmp/test.png', 'page1');

            expect(sharp).toHaveBeenCalledWith('/tmp/test.png');
            expect(result).toMatch(/page1_.*_final_processed\.png$/);
        });

        test('applies grayscale, resize, normalize, sharpen, blur, and threshold', async () => {
            await preprocessImageWithSteps('/tmp/test.png');

            const mockInstance = sharp();
            expect(mockInstance.grayscale).toHaveBeenCalled();
            expect(mockInstance.resize).toHaveBeenCalledWith(expect.objectContaining({ width: 3000 }));
            expect(mockInstance.normalize).toHaveBeenCalled();
            expect(mockInstance.sharpen).toHaveBeenCalled();
            expect(mockInstance.blur).toHaveBeenCalledWith(0.5);
            expect(mockInstance.threshold).toHaveBeenCalledWith(160);
        });
    });

    describe('advancedPreprocessWithSteps', () => {
        test('creates original copy and processed output', async () => {
            const result = await advancedPreprocessWithSteps('/tmp/test.png', 'adv');

            expect(sharp).toHaveBeenCalledWith('/tmp/test.png');
            expect(result).toMatch(/adv_.*_final_processed\.png$/);
        });

        test('applies grayscale, median, linear, resize, sharpen, and threshold', async () => {
            await advancedPreprocessWithSteps('/tmp/test.png');

            const mockInstance = sharp();
            expect(mockInstance.grayscale).toHaveBeenCalled();
            expect(mockInstance.median).toHaveBeenCalledWith(3);
            expect(mockInstance.linear).toHaveBeenCalledWith(1.5, -(128 * 1.5) + 128);
            expect(mockInstance.sharpen).toHaveBeenCalledWith({ sigma: 1.5 });
            expect(mockInstance.threshold).toHaveBeenCalledWith(140);
        });
    });

    describe('clearTempFolder', () => {
        test('deletes all files in temp folder', async () => {
            fs.readdir.mockResolvedValue(['file1.png', 'file2.png']);

            await clearTempFolder();

            expect(fs.unlink).toHaveBeenCalledTimes(2);
        });

        test('handles missing temp folder gracefully', async () => {
            fs.readdir.mockRejectedValue(new Error('ENOENT'));

            await expect(clearTempFolder()).resolves.not.toThrow();
        });
    });
});
