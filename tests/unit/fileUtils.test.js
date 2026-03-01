const fs = require('fs');
const { execFile } = require('child_process');

jest.mock('fs');
jest.mock('child_process');

const { deleteFile, convertPdfToImages } = require('../../src/utils/fileUtils');

describe('deleteFile', () => {
    afterEach(() => jest.clearAllMocks());

    test('deletes file when it exists', () => {
        fs.existsSync.mockReturnValue(true);
        fs.unlinkSync.mockImplementation(() => {});

        deleteFile('/tmp/test.png');

        expect(fs.existsSync).toHaveBeenCalledWith('/tmp/test.png');
        expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/test.png');
    });

    test('does nothing when file does not exist', () => {
        fs.existsSync.mockReturnValue(false);

        deleteFile('/tmp/missing.png');

        expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    test('handles errors gracefully', () => {
        fs.existsSync.mockReturnValue(true);
        fs.unlinkSync.mockImplementation(() => { throw new Error('permission denied'); });

        expect(() => deleteFile('/tmp/locked.png')).not.toThrow();
    });
});

describe('convertPdfToImages', () => {
    const util = require('util');
    const path = require('path');

    afterEach(() => jest.clearAllMocks());

    test('converts PDF and returns sorted page paths', async () => {
        const mockExecFile = jest.fn().mockResolvedValue({ stdout: '', stderr: '' });
        execFile.mockImplementation((cmd, args, cb) => {
            cb(null, '', '');
        });

        const execFilePromise = require('util').promisify(execFile);

        fs.readdirSync.mockReturnValue([
            'test-2.jpg',
            'test-1.jpg',
            'test-3.jpg'
        ]);

        const result = await convertPdfToImages('/tmp/uploads/test.pdf');

        expect(execFile).toHaveBeenCalled();
        expect(result).toHaveLength(3);
        expect(result[0]).toContain('test-1.jpg');
        expect(result[1]).toContain('test-2.jpg');
        expect(result[2]).toContain('test-3.jpg');
    });

    test('throws on pdftoppm not found (ENOENT)', async () => {
        const err = new Error('spawn pdftoppm ENOENT');
        err.code = 'ENOENT';
        execFile.mockImplementation((cmd, args, cb) => cb(err));

        await expect(convertPdfToImages('/tmp/test.pdf')).rejects.toThrow();
    });
});
