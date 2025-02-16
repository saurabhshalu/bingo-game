import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { BingoGame } from './game.js';
import { randomRoomId } from './helper.js';

const app = express();
const server = http.createServer(app);
const io = new Server();
io.listen(server);


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ROOMS = {}
const SOCKET_ROOM_MAPPING = {}

const joinRoom = (socket, roomId, player) => {

    socket.join(roomId);
    const myRoom = ROOMS[roomId];
    const myBoard = myRoom.game.prepareBlankChart();
    myRoom.players.push({
        name: player.name,
        id: socket.id,
        win: 0,
        board: myBoard
    })

    SOCKET_ROOM_MAPPING[socket.id] = roomId;

    io.to(roomId).emit('join-room', {
        roomId,
        players: myRoom.players.map(i => ({ name: i.name, win: i.win, id: i.id })),
        selection: myRoom.game.USER_SELECTION,
        currentPlayer: myRoom.players[myRoom.currentPlayer].id
    })
    socket.emit('my-board', myBoard);
}


const getWinners = ({ game, players }) => {
    const winners = [];
    players.forEach((player, index) => {
        const { bingo } = game.evaluateTable(player.board);
        if (bingo) {
            players[index].win += 1;
            winners.push(player);
        }
    })
    return winners;
}


io.on('connection', (socket) => {
    socket.on('createRoom', (player) => {
        const roomId = randomRoomId();
        if (ROOMS[roomId]) {
            return socket.emit("error", {
                message: "Something went wrong while creating room, please try again."
            })
        }
        if (player.maxPlayers && player.maxPlayers < 2) {
            return socket.emit("error", {
                message: "Atleast 2 players are required"
            })
        }

        const game = new BingoGame({ size: player.maxPlayers });

        ROOMS[roomId] = {
            game,
            players: [],
            min: 2,
            max: player.maxPlayers || 5,
            owner: socket.id,
            started: false,
            currentPlayer: 0
        }

        joinRoom(socket, roomId, player);


    })

    socket.on('joinRoom', (player) => {
        const roomId = player.roomId;
        if (!roomId || !ROOMS[roomId]) {
            return socket.emit('error', { message: "Room does not exist" });
        }
        const myRoom = ROOMS[roomId];
        if (myRoom.started) {
            return socket.emit('error', { message: "Game has already been started" })
        }
        if (myRoom.players.length >= myRoom.max) {
            return socket.emit('error', { message: "Room is full" })
        }

        joinRoom(socket, roomId, player)
    })

    socket.on('playMove', (number) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) {
            return socket.emit('error', { message: "Room not found, please join again" })
        }
        if (!myRoom.started) {
            return socket.emit('error', { message: "The game has not started yet" })
        }

        if (myRoom.players[myRoom.currentPlayer]?.id !== socket.id) {
            return socket.emit('error', { message: 'Wait for your turn please' })
        }
        const validPlay = myRoom.game.play(number);
        if (!validPlay) {
            return socket.emit('error', { message: 'You can not undo the already played move' })
        }

        const winners = getWinners(myRoom);

        if (winners.length > 0) {
            return io.to(roomId).emit('game-over', {
                winners: winners.map(i => ({ id: i.id, name: i.name, win: i.win })),
                players: Object.values(myRoom.players).map(i => ({ name: i.name, win: i.win, id: i.id })),
                selection: myRoom.game.USER_SELECTION
            })
        }
        myRoom.currentPlayer = (myRoom.currentPlayer + 1) % myRoom.players.length;
        const payload = {
            players: Object.values(myRoom.players).map(i => ({ name: i.name, win: i.win, id: i.id })),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer].id
        }
        io.to(roomId).emit('play-move', payload)
    })

    socket.on('playStart', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (myRoom.owner !== socket.id) {
            return socket.emit('error', { message: "Only owner can start the game" })
        }
        myRoom.currentPlayer = myRoom.players.findIndex(x => x.id === socket.id) || 0;
        myRoom.started = true;
        io.to(roomId).emit('play-started', {
            currentPlayer: myRoom.players[myRoom.currentPlayer].id,
            started: true
        })
    })

    socket.on('playRestart', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (myRoom.owner !== socket.id) {
            return socket.emit('error', { message: "Only owner can restart the game" })
        }

        myRoom.game.restart();
        myRoom.players.forEach((player, index) => {
            const board = myRoom.game.prepareBlankChart();
            myRoom.players[index].board = board;
            io.to(player.id).emit('play-restart', ({ myBoard: board, selection: myRoom.game.USER_SELECTION }))
        })
    })

    socket.on('disconnect', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];

        if (!myRoom) {
            return;
        }

        const leftPlayer = myRoom.players.find(p => p.id === socket.id);

        let currentPlayerId = myRoom.players[myRoom.currentPlayer]?.id || null;
        const nextPlayerId = myRoom.players[(myRoom.currentPlayer + 1) % myRoom.players.length].id
        const players = myRoom.players.filter(player => player.id !== socket.id);


        ROOMS[roomId].players = players;



        if (players.length === 0) {
            delete SOCKET_ROOM_MAPPING[socket.id]
            delete ROOMS[roomId]
            return;
        }

        const payload = {
            leftPlayerName: leftPlayer.name,
            players: Object.values(myRoom.players).map(i => ({ name: i.name, win: i.win, id: i.id })),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: players.findIndex(p => p.id === currentPlayerId) >= 0 ? currentPlayerId : nextPlayerId
        }

        if (leftPlayer.id === myRoom.owner) {
            myRoom.owner = nextPlayerId;
            payload.owner = nextPlayerId;
        }

        io.to(roomId).emit('player-left', payload)
    })
})



app.get('/', (req, res) => {
    return res.json({ success: true })
})


server.listen(6969, console.log(`Server started on port: 6969`))