export class AudioManager {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('bingo_muted') === 'true';
        this.volume = parseFloat(localStorage.getItem('bingo_volume') || '0.6');
        this.preloaded = {};
        this.chimeGracePeriod = true;
        // Suppress rapid chimes on initial load / rejoin
        setTimeout(() => { this.chimeGracePeriod = false; }, 1500);
        this.init();
    }

    init() {
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
        this.preloadMp3s();
    }

    preloadMp3s() {
        const sounds = [
            '/sounds/win1.mp3', '/sounds/win2.mp3', '/sounds/win3.mp3',
            '/sounds/win4.mp3', '/sounds/win5.mp3',
            '/sounds/lose1.mp3', '/sounds/lose2.mp3', '/sounds/lose3.mp3', '/sounds/lose4.mp3'
        ];
        sounds.forEach(src => {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.volume = this.muted ? 0 : this.volume;
            this.preloaded[src] = audio;
        });
    }

    setMuted(muted) {
        this.muted = muted;
        localStorage.setItem('bingo_muted', muted);
        Object.values(this.preloaded).forEach(a => { a.volume = muted ? 0 : this.volume; });
    }

    setVolume(vol) {
        this.volume = vol;
        localStorage.setItem('bingo_volume', vol);
        Object.values(this.preloaded).forEach(a => { a.volume = this.muted ? 0 : vol; });
    }

    playMp3(src) {
        if (this.muted) return;
        const audio = this.preloaded[src];
        if (audio) {
            audio.currentTime = 0;
            audio.volume = this.volume;
            audio.play().catch(() => {});
        }
    }

    getRandomWinSound() {
        const wins = ['/sounds/win1.mp3', '/sounds/win2.mp3', '/sounds/win3.mp3', '/sounds/win4.mp3', '/sounds/win5.mp3'];
        return wins[Math.floor(Math.random() * wins.length)];
    }

    getRandomLoseSound() {
        const loses = ['/sounds/lose1.mp3', '/sounds/lose2.mp3', '/sounds/lose3.mp3', '/sounds/lose4.mp3'];
        return loses[Math.floor(Math.random() * loses.length)];
    }

    playWin() {
        this.playMp3(this.getRandomWinSound());
    }

    playLose() {
        this.playMp3(this.getRandomLoseSound());
    }

    // ---- Web Audio API synthesized sounds ----

    playTone({ freq = 440, duration = 0.2, type = 'sine', volume = 0.3, delay = 0 }) {
        if (this.muted || !this.ctx) return;
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume * this.volume, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + duration + 0.1);
    }

    playChime(level) {
        if (this.chimeGracePeriod) return;
        // C major pentatonic build-up: C5, D5, E5, G5, C6
        const notes = [523.25, 587.33, 659.25, 783.99, 1046.50];
        const freq = notes[(level - 1) % notes.length];
        this.playTone({ freq, duration: 0.4, type: 'sine', volume: 0.25 });
        // Harmonic overtone for richness
        this.playTone({ freq: freq * 2, duration: 0.3, type: 'sine', volume: 0.08, delay: 0.05 });
    }

    playPop() {
        this.playTone({ freq: 800, duration: 0.08, type: 'sine', volume: 0.15 });
    }

    playTurnBell() {
        this.playTone({ freq: 880, duration: 0.15, type: 'sine', volume: 0.2 });
        this.playTone({ freq: 1100, duration: 0.2, type: 'sine', volume: 0.2, delay: 0.12 });
    }

    playNotification() {
        this.playTone({ freq: 600, duration: 0.1, type: 'sine', volume: 0.15 });
    }

    playJoin() {
        this.playTone({ freq: 523, duration: 0.1, type: 'sine', volume: 0.15 });
        this.playTone({ freq: 659, duration: 0.15, type: 'sine', volume: 0.15, delay: 0.1 });
    }

    playLeave() {
        this.playTone({ freq: 440, duration: 0.2, type: 'triangle', volume: 0.1 });
    }

    playError() {
        this.playTone({ freq: 200, duration: 0.15, type: 'sawtooth', volume: 0.1 });
    }

    resumeContext() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
}

export const audioManager = new AudioManager();
