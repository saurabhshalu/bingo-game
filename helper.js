
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789';
export const randomRoomId = customAlphabet(alphabet, 6);

export const shuffle = (array) => {
    const copy = [...array];
    let m = copy.length, t, i;
    while (m) {
        i = Math.floor(Math.random() * m--);
        t = copy[m];
        copy[m] = copy[i];
        copy[i] = t;
    }
    return copy;
}
