# online-ocr-free

This repository is now a minimal wrapper around the `tesseract` CLI.

## Requirements

- Node.js
- Tesseract installed and available on your `PATH`

## Usage

```bash
npm run ocr -- image.png
```

That writes `image.txt` next to the input PNG.

You can also choose the output file:

```bash
npm run ocr -- image.png output.txt
```
