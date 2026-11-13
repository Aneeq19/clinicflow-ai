import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types


load_dotenv(
    Path(__file__).resolve().parent / ".env",
    override=True,
)

api_key = os.getenv("GEMINI_API_KEY")
model = os.getenv("GEMINI_MODEL")

if not api_key or not model:
    raise SystemExit("Gemini settings are missing from backend/.env")

print("Testing Interactions API:", model, flush=True)

try:
    with genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            timeout=30000,
            retry_options=types.HttpRetryOptions(attempts=1),
        ),
    ) as client:
        result = client.interactions.create(
            model=model,
            input="Reply with only: ClinicFlow AI connected",
            timeout=30.0,
        )

    print("Reply:", result.output_text or "No text returned.")

except Exception as error:
    print("Error type:", type(error).__name__)
    safe_message = str(error).replace(api_key, "[REDACTED]")
    print("Message:", safe_message[:1000])