# SIG-SCOPE: Explainable Blind Signal Intelligence Platform

[![Deployment](https://img.shields.io/badge/Live%20Demo-sigscope.vercel.app-1b7f5c?style=flat&logo=vercel)](https://sigscope.vercel.app/)
[![Dataset](https://img.shields.io/badge/Benchmark%20Dataset-Google%20Drive-4285F4?style=flat&logo=googledrive)](https://drive.google.com/drive/folders/1KrOPCZMcVUvNDREoQKJOBvBRMU3EgLRs?usp=sharing)
[![SIH](https://img.shields.io/badge/SIH%202026-PS%20SIH26147-blue?style=flat)](https://sigscope.vercel.app/)

**Smart India Hackathon 2026** | **Problem Statement:** SIH26147 (*Automated model for analysis of .IQ and .wav files along with signal parameter extraction*)  
**Theme:** Space Technology | **Category:** Software  

* **Live Deployed Web Application:** [https://sigscope.vercel.app/](https://sigscope.vercel.app/)
* **Benchmark RF Captures (Google Drive):** [https://drive.google.com/drive/folders/1KrOPCZMcVUvNDREoQKJOBvBRMU3EgLRs?usp=sharing](https://drive.google.com/drive/folders/1KrOPCZMcVUvNDREoQKJOBvBRMU3EgLRs?usp=sharing)

SIG-SCOPE is an open, deterministic Signal Intelligence (SIGINT) and parameter extraction engine. It bridges high-performance Python Digital Signal Processing (DSP) with a responsive, real-time Next.js frontend visualization dashboard.

Unlike black-box AI tools, SIG-SCOPE employs an **"Honesty Gate"** architecture. It relies on rigorous, deterministic mathematical telemetry (Higher-Order Cumulants, Oerder-Meyr timing recovery, Viterbi decoding). If a signal parameter cannot be confidently resolved, the system explicitly abstains rather than hallucinating plausible-looking but incorrect data.

## Features

- **Automated Parameter Estimation**: Extracts Baud rate, Modulation, and Bandwidth automatically.
- **Deep Demodulation Telemetry**: Analyzes BPSK, QPSK, 8PSK, 16QAM, and 64QAM.
- **FEC & Interleaving**: Built-in Viterbi decoding for convolutional codes and blind block-interleaver search for coded frames.
- **Rich Interactive Visualizations**:
  - Full-band FFT Spectrum with dynamic user-controlled auto-zoom.
  - STFT Waterfall plots.
  - Symbol-level tabbed analytics: Constellation, IQ Plots, and Eye Diagrams.
- **Offline MVP Pipeline**: Custom datasets (`.iq`, `.wav`) can be uploaded directly via the UI. The Next.js API automatically routes the file to the local Python DSP engine for immediate, private processing.
- **Audio Playback**: Sleek, integrated audio transport for listening to `.wav` intercepts.

## Architecture

1. **Python Core (`dsp/`)**: NumPy/SciPy/CommPy-based processing engine.
2. **Analysis Pipeline (`scripts/analyze.py`)**: End-to-end processing pipeline that generates lightweight, static JSON files in `public/runs/`.
3. **Next.js Frontend (`app/`)**: Consumes the JSON telemetry to render beautiful HTML5 Canvas visualizations without blocking the main UI thread.

## Usage

### 1. Start the Dashboard (UI)
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`.

### 2. Run DSP Analysis (Backend)
To regenerate the built-in datasets or manually process cases:
```bash
python -u scripts/analyze.py
```
*Note: You can also just upload files via the "Load File" button in the UI, which will automate this step.*

### 3. Run Validation Tests
To verify the DSP math against known synthetic ground-truth targets:
```bash
python scripts/validate.py
```

## Contributing
When working on the DSP core, **never fabricate a measurement**. If an algorithm (like blind AMC or carrier recovery) fails, ensure it returns `None` or an explicit abstention reason. The UI is designed to handle and display these edge cases gracefully.
