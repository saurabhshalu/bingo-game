
import { customAlphabet } from 'nanoid';
const alphabet = '0123456789';
export const randomRoomId = customAlphabet(alphabet, 6);

export const shuffle = (array) => {
    var m = array.length, t, i;
    while (m) {
        i = Math.floor(Math.random() * m--);
        t = array[m];
        array[m] = array[i];
        array[i] = t;
    }

    return array;
}
