import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { BingoGame } from './game.js';
import { randomRoomId } from './helper.js';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server();
io.listen(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "build")));
app.use(express.static("public"));

// SPA fallback so /game/:roomId works on refresh
app.get('/game/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const ROOMS = {}
const SOCKET_ROOM_MAPPING = {}

const PLAYER_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981',
    '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'
];
const getRandomColor = () => PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

const getNextConnectedIndex = (room, startIndex) => {
    const len = room.players.length;
    if (len === 0) return 0;
    if (room.players.every(p => !p.connected)) return startIndex % len;
    let idx = (startIndex + 1) % len;
    let attempts = 0;
    while ((!room.players[idx] || !room.players[idx].connected) && attempts < len) {
        idx = (idx + 1) % len;
        attempts++;
    }
    return idx;
};

const getConnectedCount = (room) => room.players.filter(p => p.connected).length;

const getPlayerBingoCount = (playerBoard, game) => {
    const size = game.size;
    const answers = [];
    const diag1 = [];
    const diag2 = [];
    for (let i = 0; i < size; i++) {
        const list1 = [];
        const list2 = [];
        for (let j = 0; j < size; j++) {
            list1.push((i * size) + j + 1);
            list2.push(i + 1 + (j * size));
        }
        answers.push(list1);
        answers.push(list2);
        diag1.push((i * size) + (i + 1));
        diag2.push(size - i + (size * i));
    }
    answers.push(diag1);
    answers.push(diag2);
    return answers.filter(path => path.every(item => game.USER_SELECTION[playerBoard[item - 1]])).length;
};

const getWinners = ({ game, players }) => {
    const winners = [];
    players.forEach((player, index) => {
        if (!player.connected) return;
        const { bingo } = game.evaluateTable(player.board);
        if (bingo) {
            players[index].win += 1;
            winners.push(player);
        }
    })
    return winners;
};

const getUnplayedNumbers = (game) => {
    return Object.keys(game.USER_SELECTION).filter(n => !game.USER_SELECTION[n]);
};

const serializePlayer = (p, game = null) => ({
    name: p.name,
    win: p.win,
    id: p.id,
    playerId: p.playerId,
    connected: p.connected,
    color: p.color,
    avatar: p.avatar || null,
    bingoCount: game ? getPlayerBingoCount(p.board, game) : 0
});

const getTournamentWinners = (room) => {
    if (!room.winsToReach || room.winsToReach <= 1) return null;
    const maxWins = Math.max(...room.players.map(p => p.win));
    if (maxWins >= room.winsToReach) {
        return room.players.filter(p => p.win === maxWins);
    }
    return null;
};

const clearTurnTimer = (room) => {
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }
    room.turnDeadline = null;
};

const pauseTurnTimer = (room) => {
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }
};

const startTurnTimer = (room, roomId) => {
    clearTurnTimer(room);
    if (getConnectedCount(room) < 2) return;
    const TURN_DURATION = 15000; // 10 seconds
    room.turnDeadline = Date.now() + TURN_DURATION;
    room.turnTimer = setTimeout(() => {
        handleAutoRandomMove(roomId);
    }, TURN_DURATION);
};

const broadcastTurnState = (room, roomId, extra = {}) => {
    const currentPlayerObj = room.players[room.currentPlayer];
    io.to(roomId).emit('turn-state', {
        players: room.players.map(p => serializePlayer(p, room.game)),
        selection: room.game.USER_SELECTION,
        currentPlayer: currentPlayerObj?.id || null,
        turnDeadline: room.turnDeadline,
        started: room.started,
        finished: room.finished,
        gameCount: room.gameCount,
        ...extra
    });
};

const handleAutoRandomMove = (roomId) => {
    const myRoom = ROOMS[roomId];
    if (!myRoom || myRoom.finished || !myRoom.started) return;
    if (getConnectedCount(myRoom) < 2) {
        clearTurnTimer(myRoom);
        return;
    }

    const unplayed = getUnplayedNumbers(myRoom.game);
    if (unplayed.length === 0) return;

    const randomNumber = unplayed[Math.floor(Math.random() * unplayed.length)];
    const number = Number(randomNumber);

    const validPlay = myRoom.game.play(number);
    if (!validPlay) {
        // Number was somehow already played — just advance turn
        myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
        startTurnTimer(myRoom, roomId);
        io.to(roomId).emit('play-move', {
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            lastMove: null,
            lastPlayerId: null,
            lastPlayerName: null,
            isRandom: true,
            turnDeadline: myRoom.turnDeadline
        });
        return;
    }

    const actingPlayer = myRoom.players[myRoom.currentPlayer];
    const winners = getWinners(myRoom);
    pauseTurnTimer(myRoom);

    if (winners.length > 0) {
        myRoom.finished = true;
        myRoom.winners = winners.map(i => ({ id: i.id, name: i.name, win: i.win, playerId: i.playerId }));
        const tournamentWinners = getTournamentWinners(myRoom);
        if (tournamentWinners) myRoom.tournamentFinished = true;
        return io.to(roomId).emit('game-over', {
            winners: myRoom.winners,
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
            selection: myRoom.game.USER_SELECTION,
            gameCount: myRoom.gameCount,
            lastMove: number,
            lastPlayerId: actingPlayer?.playerId,
            lastPlayerName: actingPlayer?.name,
            isRandom: true,
            winsToReach: myRoom.winsToReach,
            tournamentFinished: myRoom.tournamentFinished,
            turnDeadline: myRoom.turnDeadline,
            tournamentWinners: tournamentWinners ? tournamentWinners.map(i => ({ id: i.id, name: i.name, win: i.win, playerId: i.playerId })) : null
        });
    }

    myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
    startTurnTimer(myRoom, roomId);

    const payload = {
        players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
        selection: myRoom.game.USER_SELECTION,
        currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
        lastMove: number,
        lastPlayerId: actingPlayer?.playerId,
        lastPlayerName: actingPlayer?.name,
        isRandom: true,
        turnDeadline: myRoom.turnDeadline
    };
    io.to(roomId).emit('play-move', payload);
};

const joinRoom = (socket, roomId, player, isRejoin = false) => {
    socket.join(roomId);
    const myRoom = ROOMS[roomId];
    const existingIdx = myRoom.players.findIndex(p => p.playerId === player.playerId);

    if (isRejoin && existingIdx !== -1) {
        const existing = myRoom.players[existingIdx];
        existing.id = socket.id;
        existing.connected = true;
        existing.name = player.name;
        if (player.avatar) existing.avatar = player.avatar;
        SOCKET_ROOM_MAPPING[socket.id] = roomId;

        if (myRoom.started && !myRoom.finished && getConnectedCount(myRoom) >= 2 && !myRoom.turnTimer) {
            startTurnTimer(myRoom, roomId);
        }

        socket.emit('rejoined', {
            roomId,
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null,
            gameCount: myRoom.gameCount,
            started: myRoom.started,
            finished: myRoom.finished,
            winners: myRoom.winners,
            chatHistory: myRoom.chatHistory,
            myBoard: existing.board,
            ownerPlayerId: myRoom.ownerPlayerId,
            turnDeadline: myRoom.turnDeadline,
            maxPlayers: myRoom.max,
            winsToReach: myRoom.winsToReach,
            tournamentFinished: myRoom.tournamentFinished,
            tournamentWinners: myRoom.tournamentWinners,
            gameStartTime: myRoom.gameStartTime
        });

        socket.to(roomId).emit('player-rejoined', {
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null,
            rejoinedPlayerId: existing.playerId,
            turnDeadline: myRoom.turnDeadline
        })
    } else {
        const myBoard = myRoom.game.prepareBlankChart();
        const playerColor = player.color || getRandomColor();
        const newPlayer = {
            name: player.name,
            id: socket.id,
            playerId: player.playerId,
            win: 0,
            board: myBoard,
            connected: true,
            color: playerColor,
            avatar: player.avatar || null
        };
        myRoom.players.push(newPlayer);
        SOCKET_ROOM_MAPPING[socket.id] = roomId;

        socket.emit('my-board', { myBoard, roomId });
        io.to(roomId).emit('join-room', {
            roomId,
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null,
            gameCount: myRoom.gameCount,
            started: myRoom.started,
            ownerPlayerId: myRoom.ownerPlayerId,
            turnDeadline: myRoom.turnDeadline,
            maxPlayers: myRoom.max,
            winsToReach: myRoom.winsToReach,
            gameStartTime: myRoom.gameStartTime
        });
    }
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
                message: "At least 2 players are required"
            })
        }

        const maxPlayers = Math.min(Math.max(player.maxPlayers || 5, 2), 10);
        const winsToReach = Math.min(Math.max(player.winsToReach || 1, 1), 51);
        const game = new BingoGame({ size: maxPlayers });

        ROOMS[roomId] = {
            game,
            players: [],
            min: 2,
            max: maxPlayers,
            winsToReach: winsToReach,
            tournamentFinished: false,
            owner: socket.id,
            ownerPlayerId: player.playerId,
            started: false,
            currentPlayer: 0,
            finished: false,
            gameCount: 1,
            winners: [],
            chatHistory: [],
            turnTimer: null,
            turnDeadline: null,
            gameStartTime: null,
            voteKick: null
        }

        joinRoom(socket, roomId, player, false);
    })

    socket.on('joinRoom', (player) => {
        const roomId = player.roomId?.toString().trim();
        if (!roomId || !ROOMS[roomId]) {
            return socket.emit('error', { message: "Room does not exist" });
        }
        const myRoom = ROOMS[roomId];
        const existingPlayer = myRoom.players.find(p => p.playerId === player.playerId);

        if (existingPlayer) {
            // Always allow same playerId to rejoin — old socket will disconnect/clean up on its own
            return joinRoom(socket, roomId, player, true);
        }

        if (myRoom.started) {
            return socket.emit('error', { message: "Game has already been started" })
        }
        if (getConnectedCount(myRoom) >= myRoom.max) {
            return socket.emit('error', { message: "Room is full" })
        }

        joinRoom(socket, roomId, player, false);
    })

    socket.on('playMove', (number) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) {
            return socket.emit('error', { message: "Room not found, please join again" })
        }
        if (myRoom.finished) {
            return socket.emit('error', { message: 'Game already finished' });
        }
        if (!myRoom.started) {
            return socket.emit('error', { message: "The game has not started yet" })
        }

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || !me.connected) {
            return socket.emit('error', { message: 'Not in game' });
        }

        const currentPlayerObj = myRoom.players[myRoom.currentPlayer];
        if (!currentPlayerObj || currentPlayerObj.id !== socket.id) {
            return socket.emit('error', { message: 'Wait for your turn please' })
        }
        if (myRoom.game.USER_SELECTION[number]) {
            return socket.emit('error', { message: 'Number already played' });
        }
        const validPlay = myRoom.game.play(number);
        if (!validPlay) {
            return socket.emit('error', { message: 'You can not undo the already played move' })
        }

        const winners = getWinners(myRoom);
        pauseTurnTimer(myRoom);

        if (winners.length > 0) {
            myRoom.finished = true;
            myRoom.winners = winners.map(i => ({ id: i.id, name: i.name, win: i.win, playerId: i.playerId }));
            const tournamentWinners = getTournamentWinners(myRoom);
            if (tournamentWinners) myRoom.tournamentFinished = true;
            return io.to(roomId).emit('game-over', {
                winners: myRoom.winners,
                players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
                selection: myRoom.game.USER_SELECTION,
                gameCount: myRoom.gameCount,
                lastMove: number,
                lastPlayerId: me?.playerId,
                lastPlayerName: me?.name,
                isRandom: false,
                turnDeadline: myRoom.turnDeadline,
                winsToReach: myRoom.winsToReach,
                tournamentFinished: myRoom.tournamentFinished,
                tournamentWinners: tournamentWinners ? tournamentWinners.map(i => ({ id: i.id, name: i.name, win: i.win, playerId: i.playerId })) : null
            })
        }
        myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
        startTurnTimer(myRoom, roomId);

        const payload = {
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            lastMove: number,
            lastPlayerId: me?.playerId,
            lastPlayerName: me?.name,
            isRandom: false,
            turnDeadline: myRoom.turnDeadline
        }
        io.to(roomId).emit('play-move', payload)
    })

    socket.on('playRandom', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;
        if (myRoom.finished || !myRoom.started) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me) return;
        const currentPlayerObj = myRoom.players[myRoom.currentPlayer];
        if (!currentPlayerObj || currentPlayerObj.playerId !== me.playerId) return;

        handleAutoRandomMove(roomId);
    });

    const handleVoteKickEnd = (roomId) => {
        const myRoom = ROOMS[roomId];
        if (!myRoom || !myRoom.voteKick) return;

        const { targetPlayerId, targetName, votes, timer } = myRoom.voteKick;

        // Clear the scheduled timeout (in case called early)
        if (timer) clearTimeout(timer);

        // Owner auto-votes YES
        let yesCount = 1;
        let noCount = 0;
        for (const [, vote] of votes) {
            if (vote) yesCount++;
            else noCount++;
        }

        const removed = yesCount > noCount;

        if (removed) {
            const targetIdx = myRoom.players.findIndex(p => p.playerId === targetPlayerId);
            if (targetIdx !== -1) {
                const target = myRoom.players[targetIdx];

                if (target.connected && target.id) {
                    delete SOCKET_ROOM_MAPPING[target.id];
                    const targetSocket = io.sockets.sockets.get(target.id);
                    if (targetSocket) {
                        targetSocket.emit('you-were-kicked', { targetName, reason: 'voted_out' });
                        targetSocket.disconnect();
                    }
                }

                myRoom.players.splice(targetIdx, 1);

                if (targetIdx < myRoom.currentPlayer) {
                    myRoom.currentPlayer -= 1;
                }
                if (myRoom.currentPlayer >= myRoom.players.length) {
                    myRoom.currentPlayer = 0;
                }

                if (myRoom.players.length === 0) {
                    delete ROOMS[roomId];
                    return;
                }
            }
        }

        io.to(roomId).emit('vote-kick-ended', {
            targetPlayerId,
            targetName,
            removed,
            yesCount,
            noCount,
            players: removed ? myRoom.players.map(p => serializePlayer(p, myRoom.game)) : undefined,
            currentPlayer: removed ? myRoom.players[myRoom.currentPlayer]?.id || null : undefined,
            ownerPlayerId: myRoom.ownerPlayerId
        });

        myRoom.voteKick = null;

        // Always reset turn timer for current player after vote
        if (myRoom.started && !myRoom.finished && getConnectedCount(myRoom) >= 2) {
            startTurnTimer(myRoom, roomId);
            // Broadcast the fresh turnDeadline to everyone
            io.to(roomId).emit('turn-resumed', { turnDeadline: myRoom.turnDeadline, currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null });
        }
    };

    socket.on('initiateVoteKick', ({ targetPlayerId }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) {
            return socket.emit('error', { message: "Only owner can initiate vote kick" });
        }
        if (me.playerId === targetPlayerId) {
            return socket.emit('error', { message: "Cannot vote kick yourself" });
        }
        if (myRoom.voteKick) {
            return socket.emit('error', { message: "A vote is already in progress" });
        }

        const target = myRoom.players.find(p => p.playerId === targetPlayerId);
        if (!target) return socket.emit('error', { message: "Player not found" });

        const voteDuration = 30000;
        const deadline = Date.now() + voteDuration;

        pauseTurnTimer(myRoom);

        myRoom.voteKick = {
            targetPlayerId,
            targetName: target.name,
            votes: new Map(),
            deadline,
            timer: setTimeout(() => handleVoteKickEnd(roomId), voteDuration)
        };

        io.to(roomId).emit('vote-kick-started', {
            targetPlayerId,
            targetName: target.name,
            targetColor: target.color,
            targetAvatar: target.avatar || null,
            deadline,
            initiatorId: me.playerId,
            initiatorName: me.name
        });
    });

    socket.on('castVoteKick', ({ targetPlayerId, vote }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom || !myRoom.voteKick) return;
        if (myRoom.voteKick.targetPlayerId !== targetPlayerId) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me) return;
        if (me.playerId === myRoom.voteKick.targetPlayerId) return;
        if (me.playerId === myRoom.ownerPlayerId) return;
        if (myRoom.voteKick.votes.has(me.playerId)) return;

        myRoom.voteKick.votes.set(me.playerId, vote === true);

        const totalEligible = myRoom.players.filter(p => p.playerId !== myRoom.ownerPlayerId && p.playerId !== targetPlayerId).length;
        const allVoted = myRoom.voteKick.votes.size >= totalEligible;

        io.to(roomId).emit('vote-kick-updated', {
            targetPlayerId,
            yesCount: 1 + [...myRoom.voteKick.votes.values()].filter(v => v).length,
            noCount: [...myRoom.voteKick.votes.values()].filter(v => !v).length,
            totalVoters: totalEligible
        });

        // End early if all eligible voters have cast their vote
        if (allVoted) {
            handleVoteKickEnd(roomId);
        }
    });

    socket.on('cancelVoteKick', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom || !myRoom.voteKick) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) return;

        if (myRoom.voteKick.timer) clearTimeout(myRoom.voteKick.timer);
        const targetName = myRoom.voteKick.targetName;
        const targetPlayerId = myRoom.voteKick.targetPlayerId;
        myRoom.voteKick = null;

        io.to(roomId).emit('vote-kick-cancelled', {
            targetPlayerId,
            targetName,
            reason: 'cancelled'
        });

        // Resume game timer
        if (myRoom.started && !myRoom.finished && getConnectedCount(myRoom) >= 2 && !myRoom.turnTimer) {
            startTurnTimer(myRoom, roomId);
        }
    });

    socket.on('playStart', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) {
            return socket.emit('error', { message: "Room not found, please join again" });
        }
        if (myRoom.started) {
            return socket.emit('error', { message: 'Game already started' });
        }

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) {
            return socket.emit('error', { message: "Only owner can start the game" })
        }
        if (getConnectedCount(myRoom) < 2) {
            return socket.emit('error', { message: "At least 2 players are required to play" });
        }

        myRoom.currentPlayer = myRoom.players.findIndex(p => p.playerId === myRoom.ownerPlayerId);
        if (!myRoom.players[myRoom.currentPlayer]?.connected) {
            myRoom.currentPlayer = myRoom.players.findIndex(p => p.connected);
        }

        myRoom.started = true;
        myRoom.gameStartTime = Date.now();
        startTurnTimer(myRoom, roomId);

        io.to(roomId).emit('play-started', {
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            started: true,
            turnDeadline: myRoom.turnDeadline,
            winsToReach: myRoom.winsToReach,
            maxPlayers: myRoom.max,
            gameStartTime: myRoom.gameStartTime
        })
    })

    socket.on('playRestart', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];

        if (!myRoom) {
            return socket.emit('error', { message: "Room not found, please join again" });
        }

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) {
            return socket.emit('error', { message: "Only owner can restart the game" })
        }

        if (getConnectedCount(myRoom) < 2) {
            return socket.emit('error', { message: "At least 2 players are required to play" });
        }

        clearTurnTimer(myRoom);
        myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
        myRoom.finished = false;
        myRoom.winners = [];
        myRoom.game.restart();

        if (myRoom.tournamentFinished) {
            myRoom.tournamentFinished = false;
            myRoom.gameCount = 1;
            myRoom.players.forEach(p => p.win = 0);
            myRoom.gameStartTime = Date.now();
        } else {
            myRoom.gameCount += 1;
        }

        startTurnTimer(myRoom, roomId);

        myRoom.players.forEach((player) => {
            const board = myRoom.game.prepareBlankChart();
            player.board = board;
            if (player.connected) {
                io.to(player.id).emit('play-restart', {
                    myBoard: board,
                    selection: myRoom.game.USER_SELECTION,
                    currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
                    gameCount: myRoom.gameCount,
                    turnDeadline: myRoom.turnDeadline,
                    winsToReach: myRoom.winsToReach,
                    tournamentFinished: myRoom.tournamentFinished,
                    gameStartTime: myRoom.gameStartTime,
                    players: myRoom.players.map(p => serializePlayer(p, myRoom.game))
                })
            }
        });
    })

    socket.on('updateConfig', ({ winsToReach }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) {
            return socket.emit('error', { message: "Only owner can change settings" });
        }
        if (myRoom.started && !myRoom.finished) {
            return socket.emit('error', { message: "Cannot change settings during active game" });
        }

        if (winsToReach != null) {
            myRoom.winsToReach = Math.min(Math.max(winsToReach, 1), 51);
        }

        io.to(roomId).emit('config-updated', {
            winsToReach: myRoom.winsToReach,
            maxPlayers: myRoom.max,
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game))
        });
    })

    socket.on('chat:message', ({ text }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me) return;

        const message = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            playerId: me.playerId,
            name: me.name,
            text: String(text).trim().slice(0, 100),
            timestamp: Date.now()
        };

        myRoom.chatHistory.push(message);
        if (myRoom.chatHistory.length > 50) myRoom.chatHistory.shift();

        io.to(roomId).emit('chat:message', message);
    });

    socket.on('reaction', ({ emoji, targetPlayerId }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me) return;
        if (!emoji || emoji.length > 2) return;

        io.to(roomId).emit('reaction', {
            emoji,
            fromPlayerId: me.playerId,
            fromName: me.name,
            targetPlayerId: targetPlayerId || null,
            timestamp: Date.now()
        });
    });

    socket.on('disconnect', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];

        if (!myRoom) {
            return;
        }

        const leftIndex = myRoom.players.findIndex(p => p.id === socket.id);
        if (leftIndex === -1) return;

        const leftPlayer = myRoom.players[leftIndex];
        leftPlayer.connected = false;
        delete SOCKET_ROOM_MAPPING[socket.id];

        const connectedCount = getConnectedCount(myRoom);
        if (connectedCount === 0) {
            clearTurnTimer(myRoom);
            delete ROOMS[roomId];
            return;
        }

        // Handle owner change
        if (leftPlayer.playerId === myRoom.ownerPlayerId) {
            const newOwner = myRoom.players.find(p => p.connected);
            if (newOwner) {
                myRoom.owner = newOwner.id;
                myRoom.ownerPlayerId = newOwner.playerId;
            }
        }

        // Handle turn — auto-play for disconnected player instead of skipping
        if (leftIndex === myRoom.currentPlayer) {
            clearTurnTimer(myRoom);
            if (myRoom.started && !myRoom.finished) {
                startTurnTimer(myRoom, roomId);
            }
        }

        if (getConnectedCount(myRoom) < 2) {
            clearTurnTimer(myRoom);
        }

        // Cancel active vote kick if owner or target left
        if (myRoom.voteKick) {
            if (leftPlayer.playerId === myRoom.ownerPlayerId || leftPlayer.playerId === myRoom.voteKick.targetPlayerId) {
                clearTimeout(myRoom.voteKick.timer);
                io.to(roomId).emit('vote-kick-cancelled', {
                    targetPlayerId: myRoom.voteKick.targetPlayerId,
                    targetName: myRoom.voteKick.targetName,
                    reason: leftPlayer.playerId === myRoom.ownerPlayerId ? 'owner_left' : 'target_left'
                });
                myRoom.voteKick = null;
            }
        }

        const payload = {
            leftPlayerName: leftPlayer.name,
            leftPlayerId: leftPlayer.playerId,
            players: myRoom.players.map(p => serializePlayer(p, myRoom.game)),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            owner: myRoom.owner,
            ownerPlayerId: myRoom.ownerPlayerId,
            turnDeadline: myRoom.turnDeadline
        };

        io.to(roomId).emit('player-left', payload);
    })
})

server.listen(3004, console.log(`Server started on port: 3004`))
