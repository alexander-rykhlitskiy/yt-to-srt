#!/usr/bin/env node
import { Command } from "commander";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);

// Initialize OpenAI client with LemonFox API
const openai = new OpenAI({
  apiKey: process.env.LEMONFOX_API_KEY || "YOUR_API_KEY",
  baseURL: "https://api.lemonfox.ai/v1",
});

// Setup command line interface
const program = new Command();
program
  .name("yt-to-srt")
  .description("Download YouTube videos and convert them to SRT subtitles")
  .version("1.0.0")
  .requiredOption("-u, --url <url>", "YouTube video URL")
  .option("-o, --output <directory>", "Output directory", "./")
  .option("-l, --language <language>", "Language of the video")
  .parse(process.argv);

const options = program.opts();

async function downloadYouTubeAudio(
  url: string
): Promise<{ filePath: string; title: string }> {
  console.log("Downloading audio from YouTube...");

  // Get video info to extract title
  const { stdout: info } = await execAsync(
    `yt-dlp --print filename -o "%(title)s" "${url}"`
  );
  const title = info.trim();

  // Sanitize title for filename
  const sanitizedTitle = title.replace(/[/\\?%*:|"<>]/g, "_");
  const outputPath = `${sanitizedTitle}.mp3`;

  // Download audio
  await execAsync(
    `yt-dlp -x --audio-format mp3 -o "${sanitizedTitle}.%(ext)s" "${url}"`
  );

  console.log(`Audio downloaded successfully: ${outputPath}`);
  return { filePath: outputPath, title: sanitizedTitle };
}

async function transcribeAudio(
  filePath: string,
  language?: string
): Promise<string> {
  console.log("Transcribing audio...");

  const params: any = {
    file: fs.createReadStream(filePath),
    model: "whisper-1",
    response_format: "srt",
  };

  if (language) {
    params.language = language;
  }

  const transcription = await openai.audio.transcriptions.create(params);

  return transcription.text;
}

async function saveSrtFile(
  content: string,
  filename: string,
  outputDir: string
): Promise<string> {
  const outputPath = path.join(outputDir, `${filename}.srt`);
  fs.writeFileSync(outputPath, content);
  console.log(`SRT file saved: ${outputPath}`);
  return outputPath;
}

async function main() {
  try {
    // Step 1: Download the YouTube video audio
    const { filePath, title } = await downloadYouTubeAudio(options.url);

    // Step 2: Transcribe the audio to SRT
    const transcription = await transcribeAudio(filePath, options.language);

    // Step 3: Save the SRT file
    await saveSrtFile(transcription, title, options.output);

    // Step 4: Clean up the audio file
    fs.unlinkSync(filePath);
    console.log("Audio file cleaned up");

    console.log("Process completed successfully!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
