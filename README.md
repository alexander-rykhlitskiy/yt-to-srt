# YouTube to SRT Converter

A command-line tool that downloads a YouTube video's audio and generates subtitles in SRT format using the Lemonfox.ai Speech-to-Text API.

```bash
# Install https://github.com/yt-dlp/yt-dlp?tab=readme-ov-file#release-files
npm install
echo "LEMONFOX_API_KEY=your_api_key_here" >> .env
```

## Usage

Run the tool using npx ts-node:

```bash
npx ts-node index.ts -l french -u "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Options

- `-u, --url <url>` (required): YouTube video URL
- `-o, --output <directory>`: Output directory (defaults to current directory)
- `-l, --language <language>`: Specify the language of the video (optional)

### Examples

Basic usage:

```bash
npx ts-node index.ts -u "https://www.youtube.com/watch?v=VIDEO_ID"
```

Specify output directory:

```bash
npx ts-node index.ts -u "https://www.youtube.com/watch?v=VIDEO_ID" -o ./subtitles
```

Specify language:

```bash
npx ts-node index.ts -u "https://www.youtube.com/watch?v=VIDEO_ID" -l english
```
