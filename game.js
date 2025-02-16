import { shuffle } from "./helper.js";

export class BingoGame {


    #getCorrectAnswerArray() {
        const size = this.size;
        const answers = [];

        const diagonal1 = [];
        const diagonal2 = [];
        for (let i = 0; i < size; i++) {
            const list1 = [];
            const list2 = []
            for (let j = 0; j < size; j++) {
                list1.push((i * size) + j + 1);
                list2.push(i + 1 + (j * size));
            }
            answers.push(list1);
            answers.push(list2);
            diagonal1.push((i * size) + (i + 1));
            diagonal2.push(size - i + (size * i));
        }
        answers.push(diagonal1);
        answers.push(diagonal2);

        return answers;
    }

    #getTable() {
        const size = this.size;
        return Array.from({ length: size * size }, (_, index) => index + 1);
    }
    prepareBlankChart() {
        const array = this.#getTable(this.size);
        return shuffle(array);
    }

    play(number) {
        if (this.USER_SELECTION[number]) {
            return false;
        }
        this.USER_SELECTION[number] = true;
        return true;
    }

    evaluateTable(table) {
        const bingoList = this.CORRECT_ANSWER_ARRAY.filter(path => path.every(item => {
            return this.USER_SELECTION[table[item - 1]] && true;
        }));

        return {
            bingo: bingoList.length >= this.CORRECT_ANSWER_ARRAY[0].length,
            bingoList
        }
    }

    restart() {
        this.USER_SELECTION = this.#getTable().reduce((prev, curr) => {
            return { ...prev, [curr - 1]: false };
        }, {})
    }

    constructor({ size = 5 }) {
        this.size = size;
        this.CORRECT_ANSWER_ARRAY = this.#getCorrectAnswerArray()
        this.USER_SELECTION = this.#getTable().reduce((prev, curr) => {
            return { ...prev, [curr - 1]: false };
        }, {})
    }
}