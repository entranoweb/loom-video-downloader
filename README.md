# 🎥 Enhanced Loom Video Downloader

A powerful Node.js command-line tool to download videos from loom.com with a beautiful progress bar and custom naming support. This enhanced version includes visual progress tracking, custom video naming, and smart error handling.

## ✨ Features

- 📊 Real-time download progress bar
- 📝 Custom video naming support
- 🚀 Batch download multiple videos
- ⏱️ Smart rate limiting protection
- 🔄 Resume functionality for interrupted downloads
- 📁 Automatic Downloads directory creation
- ❌ Skip already downloaded videos

## 🚀 Getting Started

### Prerequisites

- Node.js (v12 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/entranoweb/loom-video-downloader.git
```

2. Install dependencies:
```bash
cd loom-video-downloader
npm install
```

## 📖 Usage

### 1. Download a Single Video

```bash
node loom-dl.js --url https://www.loom.com/share/[VideoId]
```

Specify a custom filename:
```bash
node loom-dl.js --url https://www.loom.com/share/[VideoId] --out "My Custom Name.mp4"
```

### 2. Download Multiple Videos with Custom Names

Create a text file (e.g., `videos.txt`) with URLs and custom names, separated by `|`:
```
https://www.loom.com/share/abc123|Introduction Video
https://www.loom.com/share/def456|Setup Tutorial
https://www.loom.com/share/ghi789|Final Steps
```

Then run:
```bash
node loom-dl.js --list videos.txt
```

### 3. Output Directory

- Videos are automatically saved to a `Downloads` directory
- Specify a custom output directory:
```bash
node loom-dl.js --list videos.txt --out "path/to/custom/directory"
```

### 4. Rate Limiting Protection

The tool automatically:
- Waits 5 seconds between downloads
- Retries failed downloads with exponential backoff
- Skips already downloaded videos

## 📝 Command Options

| Option | Alias | Description |
|--------|-------|-------------|
| --url  | -u    | Single video URL |
| --list | -l    | File containing video URLs |
| --out  | -o    | Output directory or filename |
| --help | -h    | Show help |

## 🎯 Features in Detail

### Progress Bar
```
📥 ████████████████░░░░░░░░░░ 45.5MB/100MB
```
Real-time download progress with:
- Visual progress bar
- Current/Total size
- Download speed

### Custom Naming
Videos can be named using:
1. Custom names in the list file
2. Command line --out parameter
3. Default video ID if no name specified

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Original project by [EcomGraduates](https://github.com/EcomGraduates/loom-downloader)
- Enhanced with progress bar and custom naming by [entranoweb](https://github.com/entranoweb)
