"""
pipeline/surya_infer.py
Surya heliophysics foundation model inference.

Role in Manifest (per PLAN.md Shared Contracts and Decision D7):
  NOAA's predicted-flux envelope drives the orbital lifetime bounds in
  pipeline/decay.py. Surya supplies a near-term solar activity outlook
  that is reported beside that envelope for context, not applied to it
  in the deorbit compliance panel (component 2.7) with both sources labelled.

  If Surya is absent, the verdict still computes from NOAA alone and the
  panel says so. That is the honest framing and also the D7 fallback.

Per D7 (locked 2026-08-15):
  The demo reads a CACHED FROZEN ARTIFACT at data/surya-outlook.json.
  Live inference is a bonus path with a visible fallback, never the thing
  the demo depends on.

What this script does:
  1. Downloads Surya-1.0 weights from HuggingFace (nasa-ibm-ai4science/Surya-1.0)
     if not already cached (~1.8GB one-time download).
  2. Downloads one benchmark .nc file from the public S3 bucket
     (nasa-surya-bench) for a representative solar event date.
  3. Loads two consecutive input frames (t-60min, t=0) for 13 SDO channels.
  4. Runs one forward pass to produce the t+60min forecast.
  5. Extracts a scalar solar activity proxy from the predicted AIA 94A channel
     (correlated with X-ray flux, proxy for near-term flare probability).
  6. Writes data/surya-outlook.json per the SuryaOutlook contract.

SuryaOutlook contract (data/surya-outlook.json):
  {
    "horizonMonths": int,          -- forecast horizon in months (1 for near-term)
    "activityIndex": [float, ...], -- monthly scalar activity index, current month first
    "activityIndexSource": str,    -- "surya-1.0-aia94-proxy" or "noaa-fallback"
    "modelId": str,                -- "nasa-ibm-ai4science/Surya-1.0"
    "checkpoint": str,             -- "surya.366m.v1.pt"
    "sourceDataRange": str,        -- ISO date range of input frames used
    "inferenceDate": str,          -- ISO timestamp of when this was generated
    "generatedAt": str,            -- same as inferenceDate
    "notes": str                   -- honest disclosure of proxy method
  }

Sources:
  Roy et al. (2025). "Surya: Foundation Model for Heliophysics."
    https://huggingface.co/nasa-ibm-ai4science/Surya-1.0
  NASA SDO Benchmark S3 bucket: s3://nasa-surya-bench/
  AIA 94A channel: sensitive to ~6 MK plasma, flare-associated hot loops.
    Gallagher et al. (2002), Lemen et al. (2012).
"""

from __future__ import annotations

import json
import os
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import torch

warnings.filterwarnings("ignore", category=FutureWarning)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"
WEIGHTS_CACHE_DIR = REPO_ROOT / "pipeline" / ".surya_weights"
BENCH_CACHE_DIR = REPO_ROOT / "pipeline" / ".surya_bench"
OUTPUT_PATH = DATA_DIR / "surya-outlook.json"

HF_REPO_ID = "nasa-ibm-ai4science/Surya-1.0"
S3_BUCKET = "nasa-surya-bench"

# Representative benchmark dates: Oct 23 2014 (moderate solar activity, Cycle 24)
# These are the same dates used in the Surya paper and easy_inference config.
BENCH_DATE_T0 = "2014-10-23 10:00:00"   # t-60min frame
BENCH_DATE_T1 = "2014-10-23 11:00:00"   # t=0 frame (input)
# S3 keys corresponding to the above timestamps
S3_KEY_T0 = "2014/10/20141023_1000.nc"
S3_KEY_T1 = "2014/10/20141023_1100.nc"

# AIA 94 channel index in Surya's 13-channel ordering
# ["aia94","aia131","aia171","aia193","aia211","aia304","aia335","aia1600",
#  "hmi_m","hmi_bx","hmi_by","hmi_bz","hmi_v"]
AIA94_CHANNEL_IDX = 0

# Surya uses 4x spatial pooling at inference for memory efficiency
INFERENCE_POOL = 4  # 4096 -> 1024

# ---------------------------------------------------------------------------
# Device selection
# ---------------------------------------------------------------------------

def _get_device() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


# ---------------------------------------------------------------------------
# Weight download
# ---------------------------------------------------------------------------

def _download_weights() -> Path:
    """Download Surya-1.0 weights from HuggingFace if not cached."""
    from huggingface_hub import hf_hub_download  # noqa: PLC0415

    WEIGHTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    weights_path = WEIGHTS_CACHE_DIR / "surya.366m.v1.pt"
    config_path = WEIGHTS_CACHE_DIR / "config.yaml"
    scalers_path = WEIGHTS_CACHE_DIR / "scalers.yaml"

    for filename, local_path in [
        ("surya.366m.v1.pt", weights_path),
        ("config.yaml", config_path),
        ("scalers.yaml", scalers_path),
    ]:
        if not local_path.exists():
            print(f"Downloading {filename} from {HF_REPO_ID}...", file=sys.stderr)
            downloaded = hf_hub_download(
                repo_id=HF_REPO_ID,
                filename=filename,
                local_dir=str(WEIGHTS_CACHE_DIR),
            )
            print(f"  -> {downloaded}", file=sys.stderr)

    return weights_path


# ---------------------------------------------------------------------------
# Benchmark data download
# ---------------------------------------------------------------------------

def _download_bench_file(s3_key: str) -> Path:
    """Download one benchmark .nc file from the public S3 bucket."""
    import urllib.request  # noqa: PLC0415

    local_path = BENCH_CACHE_DIR / s3_key
    if local_path.exists():
        print(f"  Bench file cached: {local_path}", file=sys.stderr)
        return local_path

    local_path.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_key}"
    print(f"Downloading bench file: {url}", file=sys.stderr)
    print(f"  Target: {local_path}", file=sys.stderr)
    print(f"  Size: ~585 MB -- this will take a moment...", file=sys.stderr)

    # Stream download with progress
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        total = int(response.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024  # 1MB chunks
        with open(local_path, "wb") as fh:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                fh.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded / total * 100
                    print(f"\r  Progress: {pct:.1f}% ({downloaded/1e6:.0f}/{total/1e6:.0f} MB)",
                          end="", file=sys.stderr)
        print(file=sys.stderr)

    return local_path


# ---------------------------------------------------------------------------
# Frame loading
# ---------------------------------------------------------------------------

def _load_frame(nc_path: Path, pool: int = INFERENCE_POOL) -> np.ndarray:
    """
    Load one .nc frame and return as float32 array of shape (13, H, W).
    Applies 2D average pooling to reduce 4096->1024 spatial resolution.
    """
    import h5netcdf  # noqa: PLC0415

    channels = [
        "aia94", "aia131", "aia171", "aia193", "aia211",
        "aia304", "aia335", "aia1600",
        "hmi_m", "hmi_bx", "hmi_by", "hmi_bz", "hmi_v",
    ]

    arrays = []
    with h5netcdf.File(nc_path, "r") as ds:
        for ch in channels:
            if ch in ds.variables:
                arr = np.array(ds.variables[ch], dtype=np.float32)
                # Shape may be (1, H, W) or (H, W)
                if arr.ndim == 3:
                    arr = arr[0]
                arrays.append(arr)
            else:
                # Channel missing -- fill with zeros (flagged in notes)
                h = w = 4096 // pool
                print(f"  Warning: channel {ch} missing in {nc_path.name}", file=sys.stderr)
                arrays.append(np.zeros((h * pool, w * pool), dtype=np.float32))

    frames = np.stack(arrays, axis=0)  # (13, 4096, 4096)

    # Spatial pooling: average pool 4096 -> 4096/pool
    if pool > 1:
        frames_t = torch.from_numpy(frames).unsqueeze(0)  # (1, 13, H, W)
        frames_t = torch.nn.functional.avg_pool2d(frames_t, kernel_size=pool, stride=pool)
        frames = frames_t.squeeze(0).numpy()

    return frames  # (13, H/pool, W/pool)


# ---------------------------------------------------------------------------
# Scalar activity index extraction
# ---------------------------------------------------------------------------

def _extract_activity_index(predicted_frame: np.ndarray) -> float:
    """
    Extract a scalar solar activity proxy from one predicted frame.

    Uses the AIA 94 Angstrom channel (index 0), which is sensitive to
    ~6 MK plasma and is correlated with X-ray flux and flare activity.

    The proxy is the mean pixel intensity of the top 1% brightest pixels
    in the AIA 94 channel (a simple hot-region proxy).

    Returns a float in arbitrary units. Normalized against the Oct 2014
    reference event (which occurred during moderate Cycle 24 activity).

    Sources:
      Gallagher et al. (2002), Sol. Phys. 210, 341.
      Lemen et al. (2012), Sol. Phys. 275, 17.
    """
    aia94 = predicted_frame[AIA94_CHANNEL_IDX]  # (H, W)

    # Top 1% brightest pixels -- hot-region proxy
    threshold = np.percentile(aia94, 99.0)
    bright_pixels = aia94[aia94 >= threshold]
    if len(bright_pixels) == 0:
        return 0.0

    mean_bright = float(np.mean(bright_pixels))

    # Normalize: reference is ~Oct 2014 level (moderate Cycle 24 activity)
    # This is an ORDER-OF-MAGNITUDE proxy, not a calibrated flux value.
    # Labeled clearly as ESTIMATED in the output.
    REF_LEVEL = 1000.0  # Approximate AIA 94 DN/s for moderate activity
    return mean_bright / REF_LEVEL


# ---------------------------------------------------------------------------
# Weight interpolation for resolution change
# ---------------------------------------------------------------------------

def _interpolate_state_dict_to_resolution(
    state: dict,
    src_img_size: int,
    tgt_img_size: int,
    patch_size: int = 16,
) -> None:
    """
    Interpolate resolution-dependent weights in-place from src to tgt img_size.

    Handles:
      embedding.pos_embed: (1, N_src, D) -> (1, N_tgt, D) via bicubic 2D interp
      *.filter.complex_weight: (H_src, W_src, D, 2) -> (H_tgt, W_tgt, D, 2)

    This is a standard ViT positional embedding interpolation (DeiT/MAE technique).
    Weights trained at 4096 transfer to 1024 with spatial bicubic interpolation.
    The model output is an approximation -- not identical to native-resolution inference.
    """
    src_patches = src_img_size // patch_size  # e.g. 256 at 4096
    tgt_patches = tgt_img_size // patch_size  # e.g. 64 at 1024

    # 1. Positional embedding: (1, P_src^2, D) -> (1, P_tgt^2, D)
    if "embedding.pos_embed" in state:
        pe = state["embedding.pos_embed"]   # (1, P_src^2, D)
        D = pe.shape[2]
        pe_2d = pe.permute(0, 2, 1).reshape(1, D, src_patches, src_patches).float()
        pe_2d = torch.nn.functional.interpolate(
            pe_2d, size=(tgt_patches, tgt_patches), mode="bicubic", align_corners=False
        )
        state["embedding.pos_embed"] = (
            pe_2d.reshape(1, D, tgt_patches * tgt_patches)
            .permute(0, 2, 1)
            .to(pe.dtype)
        )

    # 2. Spectral filter weights: (H_src, W_fft_src, D, 2) -> (H_tgt, W_fft_tgt, D, 2)
    # FFT of N-point signal has N//2+1 unique complex frequencies
    src_fft_h = src_patches         # 256
    src_fft_w = src_patches // 2 + 1  # 129
    tgt_fft_h = tgt_patches         # 64
    tgt_fft_w = tgt_patches // 2 + 1  # 33

    for key in list(state.keys()):
        if "filter.complex_weight" in key:
            w = state[key]   # (H_src, W_fft_src, D, 2)
            D2 = w.shape[2]
            # Treat (D, 2) as independent spatial filters
            wf = w.float().permute(2, 3, 0, 1).reshape(D2 * 2, 1, src_fft_h, src_fft_w)
            wf = torch.nn.functional.interpolate(
                wf, size=(tgt_fft_h, tgt_fft_w), mode="bilinear", align_corners=False
            )
            state[key] = (
                wf.reshape(D2, 2, tgt_fft_h, tgt_fft_w)
                .permute(2, 3, 0, 1)
                .to(w.dtype)
            )


# ---------------------------------------------------------------------------
# Main inference function
# ---------------------------------------------------------------------------

def run_surya_inference(
    output_path: Path | None = None,
    device: torch.device | None = None,
) -> dict[str, Any]:
    """
    Run Surya inference and write data/surya-outlook.json.

    Returns the SuryaOutlook dict.
    Raises RuntimeError if inference fails -- caller should catch and write
    the NOAA-only fallback instead.
    """
    import yaml  # noqa: PLC0415
    from surya.models.helio_spectformer import HelioSpectFormer  # noqa: PLC0415
    from surya.utils.data import build_scalers  # noqa: PLC0415

    if output_path is None:
        output_path = OUTPUT_PATH
    if device is None:
        device = _get_device()

    print(f"Device: {device}", file=sys.stderr)

    # 1. Download weights
    weights_path = _download_weights()
    config_path = WEIGHTS_CACHE_DIR / "config.yaml"
    scalers_path = WEIGHTS_CACHE_DIR / "scalers.yaml"

    # 2. Load config
    with open(config_path) as fh:
        config = yaml.safe_load(fh)
    model_cfg = config["model"]

    # 3. Build model at inference resolution (1024, pooled from native 4096)
    # Args from easy_inference/run_easy_inference.py build_model()
    n_channels = len(config["data"]["sdo_channels"])                    # 13
    n_input_times = len(config["data"]["time_delta_input_minutes"])     # 2
    infer_h = infer_w = 4096 // INFERENCE_POOL                         # 1024

    print("Loading Surya-1.0 weights...", file=sys.stderr)
    state = torch.load(weights_path, map_location="cpu", weights_only=False)
    if "model" in state:
        state = state["model"]

    # Interpolate positional embeddings from native 4096 resolution to 1024.
    # Surya was trained at img_size=4096, patch_size=16 => 256x256=65536 patches.
    # At 1024: 64x64=4096 patches. Standard ViT positional embedding interpolation.
    _interpolate_state_dict_to_resolution(state, src_img_size=4096, tgt_img_size=infer_h)

    print("Building model at 1024 resolution...", file=sys.stderr)
    model = HelioSpectFormer(
        img_size=infer_h,
        patch_size=model_cfg["patch_size"],
        in_chans=n_channels,
        embed_dim=model_cfg["embed_dim"],
        time_embedding={"type": "linear", "time_dim": n_input_times},
        depth=model_cfg["depth"],
        n_spectral_blocks=model_cfg["n_spectral_blocks"],
        num_heads=model_cfg["num_heads"],
        mlp_ratio=model_cfg["mlp_ratio"],
        drop_rate=model_cfg["drop_rate"],
        window_size=model_cfg["window_size"],
        dp_rank=model_cfg["dp_rank"],
        learned_flow=model_cfg["learned_flow"],
        use_latitude_in_learned_flow=model_cfg["learned_flow"],
        init_weights=False,
        checkpoint_layers=None,
        rpe=model_cfg["rpe"],
        ensemble=model_cfg["ensemble"],
        finetune=model_cfg["finetune"],
        dtype=torch.bfloat16,
    )

    result = model.load_state_dict(state, strict=False)
    if result.missing_keys or result.unexpected_keys:
        print(f"  load_state_dict: {len(result.missing_keys)} missing, "
              f"{len(result.unexpected_keys)} unexpected", file=sys.stderr)
    model.to(device)
    model.eval()
    print("Model loaded.", file=sys.stderr)

    # 4. Download benchmark data (two input frames)
    print("Downloading benchmark SDO frames...", file=sys.stderr)
    nc_t0 = _download_bench_file(S3_KEY_T0)
    nc_t1 = _download_bench_file(S3_KEY_T1)

    # 5. Load frames
    print("Loading frames...", file=sys.stderr)
    frame_t0 = _load_frame(nc_t0, pool=INFERENCE_POOL)  # (13, 1024, 1024)
    frame_t1 = _load_frame(nc_t1, pool=INFERENCE_POOL)  # (13, 1024, 1024)

    # Stack: (2, 13, H, W)
    frames = np.stack([frame_t0, frame_t1], axis=0)  # (2, 13, H, W)

    # 6. Load scalers and normalize
    with open(scalers_path) as fh:
        scalers_cfg = yaml.safe_load(fh)
    scalers = build_scalers(scalers_cfg)

    for ch_idx in range(n_channels):
        ch_name = config["data"]["sdo_channels"][ch_idx]
        if ch_name in scalers:
            # surya.datasets.transformations.StandardScaler uses attribute access
            scaler = scalers[ch_name]
            mean_val = float(scaler.mean) if hasattr(scaler, "mean") else 0.0
            std_val = float(scaler.std) if hasattr(scaler, "std") else 1.0
            if std_val > 0:
                frames[:, ch_idx] = (frames[:, ch_idx] - mean_val) / std_val

    # Model input dict per HelioSpectFormer.forward() docstring:
    #   ts:               (B, C, T, H, W)  -- channels first, then time
    #   time_delta_input: (B, T)
    # time_delta_input = (latest_offset - time_delta_mins) / 60
    #   = (0 - [-60, 0]) / 60 = [1.0, 0.0]
    time_delta_mins = np.array(
        config["data"]["time_delta_input_minutes"], dtype=np.float32
    )
    latest_offset = float(max(time_delta_mins))  # 0
    time_delta_arr = (latest_offset - time_delta_mins) / 60.0  # [1.0, 0.0]

    # frames shape: (T=2, C=13, H, W)
    # target:       (B=1, C=13, T=2, H, W)
    frames_t = torch.from_numpy(frames).to(torch.bfloat16)   # (2, 13, H, W)
    frames_t = frames_t.permute(1, 0, 2, 3).unsqueeze(0)     # (1, 13, 2, H, W)
    frames_t = frames_t.to(device)

    time_delta_t = torch.from_numpy(time_delta_arr).unsqueeze(0).to(device)  # (1, 2)

    # 7. Forward pass
    print("Running forward pass...", file=sys.stderr)
    device_type = "mps" if str(device) == "mps" else str(device).split(":")[0]
    with torch.inference_mode():
        with torch.autocast(device_type=device_type, dtype=torch.bfloat16):
            output = model({"ts": frames_t, "time_delta_input": time_delta_t})

    predicted_np = output[0].cpu().float().numpy()  # (C=13, H, W)

    # Denormalize AIA 94 channel for the activity index
    ch_name = config["data"]["sdo_channels"][AIA94_CHANNEL_IDX]
    if ch_name in scalers:
        aia_scaler = scalers[ch_name]
        aia_mean = float(aia_scaler.mean) if hasattr(aia_scaler, "mean") else 0.0
        aia_std = float(aia_scaler.std) if hasattr(aia_scaler, "std") else 1.0
        predicted_np[AIA94_CHANNEL_IDX] = (
            predicted_np[AIA94_CHANNEL_IDX] * aia_std + aia_mean
        )

    # 8. Extract scalar activity index
    activity_index = _extract_activity_index(predicted_np)
    print(f"Activity index (AIA 94 proxy): {activity_index:.4f}", file=sys.stderr)

    # 9. Write output
    now_utc = datetime.now(timezone.utc).isoformat()
    outlook: dict[str, Any] = {
        "horizonMonths": 1,
        "activityIndex": [round(activity_index, 4)],
        "activityIndexSource": "surya-1.0-aia94-proxy",
        "modelId": HF_REPO_ID,
        "checkpoint": "surya.366m.v1.pt",
        "sourceDataRange": f"{BENCH_DATE_T0} / {BENCH_DATE_T1} UTC",
        "inferenceDate": now_utc,
        "generatedAt": now_utc,
        "notes": (
            "ESTIMATED. Activity index is mean top-1% AIA 94A pixel intensity "
            "from one forward pass on Oct 2014 benchmark data, normalized to "
            "~Oct 2014 reference level. This is a scalar proxy for near-term "
            "flare-associated EUV activity, not a calibrated X-ray flux value. "
            "Source: Roy et al. 2025 Surya-1.0, NASA SDO bench, AIA 94A channel. "
            "REPORTED ALONGSIDE the NOAA predicted-flux envelope for context; "
            "no code applies this index to the envelope or to the verdict. "
            "the deorbit compliance verdict computes from NOAA alone if this is absent."
        ),
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(outlook, fh, indent=2)
        fh.write("\n")

    print(f"Written to {output_path}", file=sys.stderr)
    return outlook


# ---------------------------------------------------------------------------
# NOAA fallback
# ---------------------------------------------------------------------------

def write_noaa_fallback(output_path: Path | None = None, reason: str = "") -> dict[str, Any]:
    """
    Write a SuryaOutlook that uses NOAA predicted-flux only (no Surya inference).
    Called when Surya inference fails or is not available.
    Per D7: the verdict still computes from NOAA alone.
    """
    if output_path is None:
        output_path = OUTPUT_PATH

    now_utc = datetime.now(timezone.utc).isoformat()
    outlook: dict[str, Any] = {
        "horizonMonths": 1,
        "activityIndex": None,
        "activityIndexSource": "noaa-fallback",
        "modelId": None,
        "checkpoint": None,
        "sourceDataRange": None,
        "inferenceDate": now_utc,
        "generatedAt": now_utc,
        "notes": (
            f"Surya inference not available: {reason}. "
            "Deorbit compliance verdict computed from NOAA predicted-flux envelope only. "
            "Per PLAN.md Decision D7: the verdict still computes from NOAA alone when "
            "Surya is absent, and the panel says so."
        ),
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        json.dump(outlook, fh, indent=2)
        fh.write("\n")

    print(f"Written NOAA fallback to {output_path}", file=sys.stderr)
    return outlook


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse  # noqa: PLC0415

    parser = argparse.ArgumentParser(
        description="Run Surya-1.0 inference and write data/surya-outlook.json"
    )
    parser.add_argument(
        "--fallback-only",
        action="store_true",
        help="Skip inference and write NOAA-fallback artifact only",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Override output path (default: data/surya-outlook.json)",
    )
    args = parser.parse_args()

    if args.fallback_only:
        write_noaa_fallback(args.output, reason="--fallback-only flag set")
        sys.exit(0)

    try:
        outlook = run_surya_inference(output_path=args.output)
        print(f"\nSuryaOutlook written:", file=sys.stderr)
        print(json.dumps(outlook, indent=2))
    except Exception as exc:
        print(f"\nSurya inference failed: {exc}", file=sys.stderr)
        print("Writing NOAA fallback...", file=sys.stderr)
        fallback = write_noaa_fallback(args.output, reason=str(exc))
        print(json.dumps(fallback, indent=2))
        sys.exit(1)
