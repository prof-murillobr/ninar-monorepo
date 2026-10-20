from __future__ import annotations

import logging
import os
import tempfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import librosa
import torch
from huggingface_hub import hf_hub_download
from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from torch import nn
from transformers import AutoFeatureExtractor, HubertModel

logger = logging.getLogger("ninar.inference")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    hf_token: str = ""
    hf_model_id: str = "dontcryai/dontcry"
    hf_model_revision: str = "158d507a8e19afeedb983f5ca25396453ac1c92b"
    hf_base_model_revision: str = "dba3bb02fda4248b6e082697eee756de8fe8aa8a"
    confidence_threshold: float = 0.70


class Prediction(BaseModel):
    category: str
    confidence: float


class ClassificationResponse(BaseModel):
    model: str
    sample_rate: int
    duration_seconds: float
    predictions: list[Prediction]
    confidence_low: bool = False
    status: str = "completed"


settings = Settings()
classifier: "BabyCryClassifier" | None = None
feature_extractor: Any | None = None
model_error: str | None = None


class BabyCryClassifier(nn.Module):
    """Reconstructs the small classification head stored by dontcryai/dontcry."""

    def __init__(self, base_model_id: str, base_model_revision: str):
        super().__init__()
        self.hubert = HubertModel.from_pretrained(base_model_id, revision=base_model_revision)
        self.classifier = nn.Sequential(
            nn.Linear(768, 512),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, 5),
        )

    def forward(self, input_values: torch.Tensor, attention_mask: torch.Tensor | None = None) -> torch.Tensor:
        outputs = self.hubert(input_values=input_values, attention_mask=attention_mask)
        pooled = outputs.last_hidden_state.mean(dim=1)
        return self.classifier(pooled)


def load_classifier() -> None:
    global classifier, feature_extractor, model_error
    try:
        feature_extractor = AutoFeatureExtractor.from_pretrained(
            "facebook/hubert-base-ls960",
            token=settings.hf_token or None,
            revision=settings.hf_base_model_revision,
        )
        model = BabyCryClassifier("facebook/hubert-base-ls960", settings.hf_base_model_revision)
        checkpoint_path = hf_hub_download(
            repo_id=settings.hf_model_id,
            filename="best_model.pth",
            token=settings.hf_token or None,
            revision=settings.hf_model_revision,
        )
        checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        classifier = model
        model_error = None
        logger.info("Loaded model %s", settings.hf_model_id)
    except Exception as exc:  # Keep health endpoint useful when credentials are missing.
        classifier = None
        model_error = f"{type(exc).__name__}: {exc}"
        logger.exception("Unable to load Hugging Face model")


@asynccontextmanager
async def lifespan(_: FastAPI):
    load_classifier()
    yield


app = FastAPI(
    title="Ninar Inference Service",
    version="0.1.0",
    description="Local baby-cry audio classification with a versioned Hugging Face model.",
    lifespan=lifespan,
)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "service": "ninar-inference",
        "status": "ok" if classifier else "degraded",
        "model": settings.hf_model_id,
        "model_loaded": classifier is not None,
    }


@app.post("/classify", response_model=ClassificationResponse)
async def classify(file: UploadFile = File(...)) -> ClassificationResponse:
    if classifier is None or feature_extractor is None:
        raise HTTPException(status_code=503, detail="Classifier is not ready; check HF_TOKEN and model access.")

    audio = await file.read()
    if not audio:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    suffix = Path(file.filename or "audio").suffix.lower() or ".audio"
    temporary_path: str | None = None
    try:
        # SoundFile can read WAV/MP3 directly from memory, but audioread's
        # ffmpeg fallback (needed for browser WebM/Opus recordings) requires
        # a filesystem path. Keep the temporary object private and remove it
        # immediately after decoding.
        with tempfile.NamedTemporaryFile(prefix="ninar-", suffix=suffix, delete=False) as temporary_file:
            temporary_file.write(audio)
            temporary_path = temporary_file.name
        waveform, sample_rate = librosa.load(temporary_path, sr=16000, mono=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Audio must be a readable WAV, MP3 or WebM file.") from exc
    finally:
        if temporary_path:
            try:
                os.unlink(temporary_path)
            except FileNotFoundError:
                pass

    if len(waveform) < 1600:
        raise HTTPException(status_code=400, detail="Audio must be at least 100 ms long.")

    inputs = feature_extractor(
        waveform,
        sampling_rate=sample_rate,
        return_tensors="pt",
        padding=True,
    )
    with torch.inference_mode():
        logits = classifier(**inputs)
        scores = torch.softmax(logits, dim=-1)[0].tolist()
    labels = ["hungry", "tired", "belly_pain", "burping", "discomfort"]
    raw_predictions = sorted(
        ({"label": label, "score": score} for label, score in zip(labels, scores)),
        key=lambda item: item["score"],
        reverse=True,
    )
    predictions = [
        Prediction(category=normalize_label(item["label"]), confidence=round(float(item["score"]), 4))
        for item in raw_predictions
    ]
    confidence_low = bool(predictions and predictions[0].confidence < settings.confidence_threshold)

    return ClassificationResponse(
        model=settings.hf_model_id,
        sample_rate=sample_rate,
        duration_seconds=round(len(waveform) / sample_rate, 3),
        predictions=predictions,
        confidence_low=confidence_low,
    )


def normalize_label(label: str) -> str:
    value = label.strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {
        "hungry": "hungry",
        "tired": "tired",
        "belly_pain": "belly_pain",
        "burping": "burping",
        "discomfort": "discomfort",
    }
    return aliases.get(value, value)
