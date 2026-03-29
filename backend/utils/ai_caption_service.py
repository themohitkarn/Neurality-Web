import base64
import json
from urllib import error as urllib_error
from urllib import request as urllib_request

from flask import current_app


class CaptionGenerationError(RuntimeError):
    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


def _dedupe(values):
    unique_values = []
    seen = set()
    for value in values:
        normalized = value.strip()
        if not normalized:
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        unique_values.append(normalized)
    return unique_values


def _fallback_hashtags(prompt):
    seed_words = [word.strip("#,.;:!?").lower() for word in (prompt or "").split()]
    words = [word for word in seed_words if len(word) >= 4][:6]
    fallback_tags = ["#neurality", "#photooftheday", "#sharethemoment"]
    fallback_tags.extend([f"#{word}" for word in words])
    return _dedupe(fallback_tags)[:10]


def _normalize_hashtags(raw_hashtags, prompt):
    if isinstance(raw_hashtags, str):
        candidates = [item for item in raw_hashtags.replace(",", " ").split(" ") if item.strip()]
    else:
        candidates = raw_hashtags or []

    normalized = []
    for item in candidates:
        tag = str(item).strip().replace(" ", "")
        if not tag:
            continue
        if not tag.startswith("#"):
            tag = f"#{tag.lstrip('#')}"
        normalized.append(tag.lower())

    normalized = _dedupe(normalized)
    return normalized[:10] if normalized else _fallback_hashtags(prompt)


def _extract_json_block(raw_text):
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        start = raw_text.find("{")
        end = raw_text.rfind("}")
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(raw_text[start : end + 1])
            except json.JSONDecodeError as exc:
                raise CaptionGenerationError("Gemini returned malformed JSON.") from exc
        raise CaptionGenerationError("Gemini returned an unreadable response.")


def _ensure_caption_count(captions, prompt):
    captions = _dedupe(captions)
    if len(captions) >= 5:
        return captions[:5]

    base_idea = (prompt or "A moment worth sharing").strip().rstrip(".")
    fallbacks = [
        base_idea,
        f"{base_idea} and I had to post it.",
        f"Keeping this frame close for a little longer.",
        f"One more look at a moment that felt right.",
        f"Saving this energy here before it fades.",
    ]

    for fallback in fallbacks:
        if len(captions) >= 5:
            break
        if fallback.strip():
            captions.append(fallback.strip())

    return _dedupe(captions)[:5]


def generate_caption_suggestions(prompt=None, image_file=None):
    api_key = current_app.config.get("GEMINI_API_KEY")
    model = current_app.config.get("GEMINI_MODEL", "gemini-2.5-flash")

    if not api_key:
        raise CaptionGenerationError("GEMINI_API_KEY is not configured on the backend.", status_code=503)

    if not prompt and not image_file:
        raise CaptionGenerationError("Provide a text prompt, an image, or both.")

    prompt_parts = [
        {
            "text": (
                "You are writing captions for Neurality, an Instagram-like social app. "
                "Return valid JSON with exactly two keys: captions and hashtags. "
                "captions must be an array of 5 distinct social-media-ready captions. "
                "hashtags must be an array of 8 to 10 relevant hashtags. "
                "Keep captions concise, natural, and varied in tone."
            )
        }
    ]

    if prompt:
        prompt_parts.append({"text": f"Prompt context: {prompt.strip()}"})

    if image_file:
        image_bytes = image_file.read()
        image_file.stream.seek(0)
        if not image_bytes:
            raise CaptionGenerationError("The uploaded image was empty.")
        prompt_parts.append(
            {
                "inline_data": {
                    "mime_type": image_file.mimetype or "image/jpeg",
                    "data": base64.b64encode(image_bytes).decode("utf-8"),
                }
            }
        )

    payload = {
        "contents": [{"parts": prompt_parts}],
        "generationConfig": {
            "temperature": 0.9,
            "topP": 0.95,
            "maxOutputTokens": 768,
        },
    }

    endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    request = urllib_request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": api_key,
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=45) as response:
            response_payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="ignore")
        raise CaptionGenerationError(
            f"Gemini request failed with status {exc.code}: {details or exc.reason}",
            status_code=502,
        ) from exc
    except urllib_error.URLError as exc:
        raise CaptionGenerationError(f"Unable to reach Gemini API: {exc.reason}", status_code=502) from exc

    try:
        raw_text = response_payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise CaptionGenerationError("Gemini did not return a usable caption response.", status_code=502) from exc

    parsed_payload = _extract_json_block(raw_text)
    captions = _ensure_caption_count(parsed_payload.get("captions", []), prompt)
    hashtags = _normalize_hashtags(parsed_payload.get("hashtags", []), prompt)

    return {
        "captions": captions,
        "hashtags": hashtags,
        "model": model,
    }
