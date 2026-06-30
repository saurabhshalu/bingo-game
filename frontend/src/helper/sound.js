export const playSound = (src) => {
    const audio = new Audio(src);
    audio.volume = 0.6;
    audio.play().catch(() => {
        // ignore autoplay restrictions
    });
};

export const getRandomItem = (arr) => {
    return arr[Math.floor(Math.random() * arr.length)];
};