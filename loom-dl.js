#!/usr/bin/env node
import axios from 'axios';
import fs, { promises as fsPromises } from 'fs';
import https from 'https';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const argv = yargs(hideBin(process.argv))
  .option('url', {
    alias: 'u',
    type: 'string',
    description: 'Url of the video in the format https://www.loom.com/share/[ID]'
  })
  .option('list', {
    alias: 'l',
    type: 'string',
    description: 'Filename of the text file containing the list of URLs'
  })
  .option('prefix', {
    alias: 'p',
    type: 'string',
    description: 'Prefix for the output filenames when downloading from a list'
  })
  .option('out', {
    alias: 'o',
    type: 'string',
    description: 'Path to output the file to or directory to output files when using --list'
  })
  .option('timeout', {
    alias: 't',
    type: 'number',
    description: 'Timeout in milliseconds to wait between downloads when using --list'
  })
  .check((argv) => {
    if (!argv.url && !argv.list) {
      throw new Error('Please provide either a single video URL with --url or a list of URLs with --list to proceed');
    }
    if (argv.url && argv.list) {
      throw new Error('Please provide either --url or --list, not both');
    }
    if (argv.timeout && argv.timeout < 0) {
      throw new Error('Please provide a non-negative number for --timeout');
    }
    return true;
  })
  .help()
  .alias('help', 'h')
  .argv;

const fetchLoomDownloadUrl = async (id) => {
  const { data } = await axios.post(`https://www.loom.com/api/campaigns/sessions/${id}/transcoded-url`);
  return data.url;
};

const backoff = (retries, fn, delay = 1000) => fn().catch(err => retries > 1 && delay <= 32000 ? new Promise(resolve => setTimeout(resolve, delay)).then(() => backoff(retries - 1, fn, delay * 2)) : Promise.reject(err));

const downloadLoomVideo = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    let receivedBytes = 0;
    let totalBytes = 0;

    const createProgressBar = (progress) => {
      const barLength = 30;
      const filledLength = Math.round(barLength * progress);
      const emptyLength = barLength - filledLength;
      const filled = '█'.repeat(filledLength);
      const empty = '░'.repeat(emptyLength);
      return `${filled}${empty}`;
    };

    https.get(url, response => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
        return;
      }

      totalBytes = parseInt(response.headers['content-length'], 10);
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

      response.on('data', chunk => {
        receivedBytes += chunk.length;
        const progress = receivedBytes / totalBytes;
        const receivedMB = (receivedBytes / (1024 * 1024)).toFixed(2);
        const progressBar = createProgressBar(progress);
        process.stdout.write(`\r📥 ${progressBar} ${receivedMB}MB/${totalMB}MB`);
      });

      response.pipe(file);

      file.on('finish', () => {
        process.stdout.write('\n'); // New line after progress
        file.close();
        resolve();
      });
    }).on('error', error => {
      fs.unlink(outputPath, () => {}); // Delete the file if download failed
      reject(error);
    });

    file.on('error', error => {
      fs.unlink(outputPath, () => {}); // Delete the file if save failed
      reject(error);
    });
  });
};

const appendToLogFile = async (id) => {
  await fsPromises.appendFile(path.join(__dirname, 'downloaded.log'), `${id}\n`);
};

const readDownloadedLog = async () => {
  try {
    const data = await fsPromises.readFile(path.join(__dirname, 'downloaded.log'), 'utf8');
    return new Set(data.split(/\r?\n/));
  } catch (error) {
    return new Set(); // If file doesn't exist, return an empty set
  }
};

const extractId = (url) => {
  url = url.split('?')[0];
  return url.split('/').pop();
};

const delay = (duration) => {
  return new Promise(resolve => setTimeout(resolve, duration));
};

// Helper function to control concurrency
async function asyncPool(poolLimit, array, iteratorFn) {
  const ret = [];
  const executing = [];
  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item, array));
    ret.push(p);

    if (poolLimit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= poolLimit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(ret);
}

// Modified downloadFromList to use asyncPool for controlled concurrency
const downloadFromList = async () => {
  const downloadedSet = await readDownloadedLog();
  const filePath = path.resolve(argv.list);
  const fileContent = await fsPromises.readFile(filePath, 'utf8');
  const lines = fileContent.split(/\r?\n/).filter(line => line.trim());
  const outputDirectory = argv.out ? path.resolve(argv.out) : path.join(__dirname, 'Downloads');

  console.log('\n📋 Found', lines.length, 'videos to download');
  console.log('📁 Output directory:', outputDirectory, '\n');

  // Create Downloads directory if it doesn't exist
  if (!fs.existsSync(outputDirectory)) {
    console.log('Creating Downloads directory...\n');
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  // Define the download task for each URL, including a delay after each download
  const downloadTask = async (line, index) => {
    const [url, customName] = line.split('|');
    const id = extractId(url.trim());
    
    // Skip if already downloaded
    if (downloadedSet.has(id)) {
      console.log(`\n⏭️ Skipping video ${id} - already downloaded\n`);
      return;
    }

    try {
      // Create a separator line for better readability
      console.log('─'.repeat(50));
      console.log(`\n🎥 Video ${index + 1}/${lines.length}: ${customName.trim()}`);
      console.log(`🔗 ID: ${id}\n`);

      const downloadUrl = await fetchLoomDownloadUrl(id);
      let filename = customName ? 
        `${customName.trim()}.mp4` : 
        (argv.prefix ? `${argv.prefix}-${index + 1}-${id}.mp4` : `${id}.mp4`);
      filename = filename.replace(/[<>:"/\\|?*]/g, '-');
      let outputPath = path.join(outputDirectory, filename);

      await backoff(5, () => downloadLoomVideo(downloadUrl, outputPath));
      await appendToLogFile(id);  // Store just the video ID
      console.log('\n✅ Download completed!\n');

      if (index < lines.length - 1) {
        console.log('⏳ Waiting 5 seconds before next download...\n');
        await delay(5000);
      }
    } catch (error) {
      console.error(`\n❌ Failed to download video ${id}:`);
      console.error(`   Error: ${error.message}\n`);
    }
  };

  // Use asyncPool to control the concurrency of download tasks
  const concurrencyLimit = 5;
  await asyncPool(concurrencyLimit, lines.map((line, index) => ({ line, index })), 
    async ({ line, index }) => await downloadTask(line, index));

  console.log('─'.repeat(50));
  console.log('\n🎉 All downloads completed!\n');
};

const downloadSingleFile = async () => {
  const id = extractId(argv.url);
  const url = await fetchLoomDownloadUrl(id);
  const filename = argv.out || `${id}.mp4`;
  console.log(`\n📥 Downloading video ${id} and saving to ${filename}`);
  await downloadLoomVideo(url, filename);
  console.log('\n✅ Download completed!\n');
};

const main = async () => {
  if (argv.list) {
    await downloadFromList();
  } else if (argv.url) {
    await downloadSingleFile();
  }
};

main();
