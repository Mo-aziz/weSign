import sys
import subprocess
import os
import signal

def start_tts_server():
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tts_dir = os.path.join(script_dir, "..", "tts_service")
    
    # Command to start the TTS server
    cmd = [sys.executable, "tts_server.py"]
    
    # Start the process
    process = subprocess.Popen(
        cmd,
        cwd=tts_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
    )
    
    # Write the process ID to a file so we can kill it later
    with open(os.path.join(tts_dir, "tts_server.pid"), "w") as f:
        f.write(str(process.pid))
    
    return process

if __name__ == "__main__":
    start_tts_server()
