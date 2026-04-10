from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from TTS.api import TTS
import uvicorn
import os
import tempfile
import base64

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize TTS model
model_name = "tts_models/en/ljspeech/glow-tts"
tts = TTS(model_name=model_name, progress_bar=False, gpu=False)

class TextRequest(BaseModel):
    text: str

@app.post("/speak")
async def speak(request: TextRequest):
    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            output_path = temp_file.name

        tts.tts_to_file(text=request.text, file_path=output_path)

        with open(output_path, "rb") as f:
            audio_data = f.read()
        
        os.unlink(output_path)
        
        return {"audio": base64.b64encode(audio_data).decode("utf-8")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
