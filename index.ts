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
  .option(
    "-f, --force",
    "Force download and transcription even if files exist",
    false
  )
  .parse(process.argv);

const options = program.opts();

async function getVideoTitle(url: string): Promise<string> {
  // Get video info to extract title
  const { stdout: info } = await execAsync(
    `yt-dlp --print filename -o "%(title)s" "${url}"`
  );
  const title = info.trim();
  // Sanitize title for filename
  return title.replace(/[/\\?%*:|"<>]/g, "_");
}

async function downloadYouTubeAudio(
  url: string,
  force: boolean = false
): Promise<{ filePath: string; title: string }> {
  const title = await getVideoTitle(url);
  const outputPath = `${title}.mp3`;

  // Check if audio file already exists
  if (fs.existsSync(outputPath) && !force) {
    console.log(`Using existing audio file: ${outputPath}`);
  } else {
    console.log("Downloading audio from YouTube...");
    // Download audio
    await execAsync(
      `yt-dlp -x --audio-format mp3 -o "${title}.%(ext)s" "${url}"`
    );
    console.log(`Audio downloaded successfully: ${outputPath}`);
  }

  return { filePath: outputPath, title: title };
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

  // With response_format: "srt", the API returns the SRT content directly as a string
  const transcription = (await openai.audio.transcriptions.create(
    params
  )) as unknown as string;

  // Clean up the transcription content by removing any leading/trailing quotes and normalizing newlines
  return cleanSrtContent(transcription);
}

// Helper function to clean SRT content
function cleanSrtContent(content: string): string {
  // Remove leading and trailing quotes if present
  let cleaned = content.trim();
  if (cleaned.startsWith('"')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.endsWith('"')) {
    cleaned = cleaned.substring(0, cleaned.length - 1);
  }

  // Normalize newlines (replace \n with actual newlines if needed)
  cleaned = cleaned.replace(/\\n/g, "\n");

  return cleaned;
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
    const force = options.force || false;
    const title = await getVideoTitle(options.url);
    const srtFilePath = path.join(options.output, `${title}.srt`);

    // Check if SRT file already exists
    if (fs.existsSync(srtFilePath) && !force) {
      console.log(`SRT file already exists: ${srtFilePath}`);
      console.log("Process completed successfully! (used cache)");
      return;
    }

    // Step 1: Download the YouTube video audio
    const { filePath, title: downloadedTitle } = await downloadYouTubeAudio(
      options.url,
      force
    );

    // Step 2: Transcribe the audio to SRT
    const transcription = await transcribeAudio(filePath, options.language);

    // Step 3: Save the SRT file
    await saveSrtFile(transcription, downloadedTitle, options.output);

    // Step 4: Clean up the audio file if it was newly downloaded
    if (!fs.existsSync(filePath) || force) {
      fs.unlinkSync(filePath);
      console.log("Audio file cleaned up");
    } else {
      console.log("Keeping audio file for cache");
    }

    console.log("Process completed successfully!");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
