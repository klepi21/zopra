import wave, math, struct

def generate_beep(filename, freq=440, duration=0.2, volume=0.5):
    sample_rate = 44100
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sample_rate)
        for i in range(int(sample_rate * duration)):
            value = int(volume * 32767.0 * math.sin(2.0 * math.pi * freq * i / sample_rate))
            f.writeframesraw(struct.pack('<h', value))

generate_beep('assets/sounds/tick.wav', freq=880, duration=0.1)
generate_beep('assets/sounds/success.wav', freq=523.25, duration=0.3)
generate_beep('assets/sounds/warning.wav', freq=300, duration=0.4)
generate_beep('assets/sounds/win.wav', freq=1046.50, duration=0.6)
generate_beep('assets/sounds/evaluating.wav', freq=440, duration=0.2)
