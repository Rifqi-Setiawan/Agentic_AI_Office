"""Original procedural Office ambience and SFX. Audio output dedicated to CC0-1.0."""
import math
import random
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'frontend/public/audio'
RATE = 22050

def save(name, duration, sample):
    with wave.open(str(OUT / f'{name}.wav'), 'wb') as wav:
        wav.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        wav.writeframes(b''.join(struct.pack('<h', round(max(-1, min(1, sample(i / RATE))) * 32767)) for i in range(round(duration * RATE))))

for name, base in [('dawn', 220), ('day', 165), ('dusk', 110), ('night', 55)]:
    # Integer periods over four seconds, seamless low-level office hum.
    save(name, 4, lambda t, f=base: .05 * math.sin(2 * math.pi * f * t) + .02 * math.sin(2 * math.pi * (f * 2) * t) * (.7 + .3 * math.cos(2 * math.pi * t / 4)))
for name, notes in [('done', [523.25, 659.25, 783.99]), ('failed', [220, 164.81, 110])]:
    def tone(t, notes=notes):
        n = min(2, int(t / .15)); local = t - n * .15
        return .2 * math.sin(2 * math.pi * notes[n] * local) * math.sin(math.pi * local / .15) ** 2
    save(name, .45, tone)
rng = random.Random(24)
save('stamp', .18, lambda t: .3 * rng.uniform(-1, 1) * math.exp(-t * 40) * min(1, t * 500))
