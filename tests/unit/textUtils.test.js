const { cleanText } = require('../../src/utils/textUtils');

describe('cleanText', () => {
    test('returns empty string for null/undefined/empty input', () => {
        expect(cleanText(null)).toBe('');
        expect(cleanText(undefined)).toBe('');
        expect(cleanText('')).toBe('');
    });

    test('fixes || misread as Dari (।)', () => {
        expect(cleanText('বাংলা|| পাঠ')).toBe('বাংলা। পাঠ');
    });

    test('fixes | surrounded by spaces as Dari', () => {
        expect(cleanText('বাংলা | পাঠ')).toBe('বাংলা। পাঠ');
    });

    test('removes leading space before Dari and adds trailing space', () => {
        expect(cleanText('বাংলা  ।পাঠ')).toBe('বাংলা। পাঠ');
    });

    test('normalizes whitespace while preserving newlines', () => {
        expect(cleanText('hello   world')).toBe('hello world');
        expect(cleanText('line1\n\nline2')).toBe('line1\n\nline2');
        expect(cleanText('hello\tworld')).toBe('hello world');
    });

    test('fixes o/O misread as Bengali zero ০ near Bengali digits', () => {
        expect(cleanText('১o২')).toBe('১০২');
        expect(cleanText('৩O৪')).toBe('৩০৪');
        expect(cleanText('৫o')).toBe('৫০');
        expect(cleanText('O৬')).toBe('০৬');
    });

    test('fixes l/1/I/| between Bengali chars as Dari', () => {
        expect(cleanText('বাংলা l বাংলা')).toBe('বাংলা । বাংলা');
        expect(cleanText('বাংলা I বাংলা')).toBe('বাংলা । বাংলা');
        expect(cleanText('বাংলা 1 বাংলা')).toBe('বাংলা । বাংলা');
    });

    test('fixes broken composite অ + া -> আ', () => {
        expect(cleanText('অ া')).toBe('আ');
        expect(cleanText('অা')).toBe('আ');
    });

    test('removes spaces around Hasant ্', () => {
        expect(cleanText('ক ্ষ')).toBe('ক্ষ');
        expect(cleanText('ক্ ষ')).toBe('ক্ষ');
    });

    test('fixes 8 misread as ৪ near Bengali digits', () => {
        expect(cleanText('১8')).toBe('১৪');
        expect(cleanText('8৫')).toBe('৪৫');
    });

    test('fixes q misread as ৭ near Bengali digits', () => {
        expect(cleanText('১q')).toBe('১৭');
        expect(cleanText('q৫')).toBe('৭৫');
    });

    test('removes isolated noise symbols', () => {
        expect(cleanText('hello ^ world')).toBe('hello world');
        expect(cleanText('hello ~ world')).toBe('hello world');
        expect(cleanText('hello _ world')).toBe('hello world');
    });

    test('trims leading and trailing whitespace', () => {
        expect(cleanText('  hello  ')).toBe('hello');
    });

    test('handles mixed Bengali and English text', () => {
        const input = 'Hello বাংলা|| পাঠ   world';
        const output = cleanText(input);
        expect(output).toBe('Hello বাংলা। পাঠ world');
    });
});
