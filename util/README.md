# Segtori Utilities

Developer utilities live here. Local datasets and generated benchmark reports
under `util/dataset/` are intentionally ignored by Git.

## OCR Dataset Benchmark

`ocrBenchmark.js` submits the paired high- and low-resolution dataset images to
a running Segtori service and writes a JSON report inside the ignored dataset
directory.

```bash
node util/ocrBenchmark.js --variant both
node util/ocrBenchmark.js --variant hires --limit 10
node util/ocrBenchmark.js --base-url http://192.168.1.219:8674
```

The current dataset has no ground-truth labels. Candidate scores, accepted-match
counts, and high/low pair agreement are diagnostic signals, not accuracy
measurements. Blurry or otherwise unusable samples should be annotated rather
than removed or used to tune image-specific behavior.

The benchmark uses whichever recognition backend the running service has
configured. Set `OCR_BACKEND=ollama` and `OLLAMA_VISION_MODEL=<model>` to
compare a local Ollama vision model, or use `OCR_BACKEND=onnx` and
`ONNX_PROVIDER=cuda` for the strict RapidOCR CUDA path.
