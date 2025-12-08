const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const rooms = {};

app.use(express.static(path.join(__dirname, "public")));

// --- Route handlers ---
app.get("/lobby", (req, res) => res.sendFile(path.join(__dirname, "public", "lobby.html")));
app.get("/words", (req, res) => res.sendFile(path.join(__dirname, "public", "words.html")));
app.get("/round1", (req, res) => res.sendFile(path.join(__dirname, "public", "round1.html")));
app.get("/round2", (req, res) => res.send("<h2>Round 2</h2>"));

io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.on("joinRoom", ({ roomId, name }) => {
        if (!roomId || !name) {
            return console.log(`Connection attempt with invalid details.`);
        }

        // Initialize the room if it doesn't exist.
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: {},
                teams: { teamA: [], teamB: [] },
                words: {},
                wordsSubmittedCount: 0,
                inProgress: false, // <-- NEW: Flag to track if the game has started
                round1: {
                    // ... (rest of round1 state)
                },
            };
        }

        const room = rooms[roomId];

        // ** THE LOCKING LOGIC **
        // If the game has started AND this player is not already in the room, block them.
        if (room.inProgress && !room.players[socket.id]) {
            socket.emit("roomLocked"); // Send a specific event to the user trying to join
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;
        socket.name = name;
        room.players[socket.id] = name;

        console.log(`Player '${name}' (${socket.id}) joined room ${roomId}`);

        // This logic correctly sends game state to reconnecting players or lobby state to new ones.
        if (room.inProgress) {
            socket.emit("gameStateUpdate", room.round1);
        } else {
            io.to(roomId).emit("lobbyUpdate", room);
        }
    });

    socket.on("joinTeam", (team) => {
        const { roomId, id: playerId, name } = socket;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        const player = { id: playerId, name };

        // Remove player from the other team if they are switching
        room.teams.teamA = room.teams.teamA.filter((p) => p.id !== playerId);
        room.teams.teamB = room.teams.teamB.filter((p) => p.id !== playerId);

        // Add player to the new team if there's space
        if (room.teams[team].length < 2) {
            room.teams[team].push(player);
        }

        io.to(roomId).emit("lobbyUpdate", room);

        if (room.teams.teamA.length === 2 && room.teams.teamB.length === 2) {
            io.to(roomId).emit("startWordSubmission");
        }
    });

    socket.on("submitWords", (submittedWords) => {
        const { roomId, id: playerId } = socket;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        room.words[playerId] = submittedWords;
        room.wordsSubmittedCount++;

        io.to(roomId).emit("wordsUpdate", room.wordsSubmittedCount);

        if (room.wordsSubmittedCount === 4) {
            // --- Set the game state to "in progress" ---
            room.inProgress = true; // <-- NEW: Lock the room when the game starts

            room.round1.allWords = Object.values(room.words).flat();
            room.round1.turnOrder = [room.teams.teamA[0], room.teams.teamB[0], room.teams.teamA[1], room.teams.teamB[1]];
            io.to(roomId).emit("startRound1");
            startTurn(roomId);
        }
    });

    socket.on("getNewWord", () => {
        const { roomId } = socket;
        if (!roomId || !rooms[roomId] || !rooms[roomId].round1.allWords.length) return;
        const room = rooms[roomId];
        const { allWords } = room.round1;
        const randomIndex = Math.floor(Math.random() * allWords.length);
        room.round1.currentWord = allWords[randomIndex];
        io.to(roomId).emit("gameStateUpdate", room.round1);
    });

    socket.on("wordGuessed", () => {
        const { roomId } = socket;
        if (!roomId || !rooms[roomId] || !rooms[roomId].round1.currentWord) return;

        const room = rooms[roomId];
        const { round1 } = room;
        const currentPlayer = round1.turnOrder[round1.currentPlayerIndex];
        const team = room.teams.teamA.some((p) => p.id === currentPlayer.id) ? "teamA" : "teamB";
        round1.scores[team]++;

        round1.allWords = round1.allWords.filter((word) => word !== round1.currentWord);
        round1.currentWord = null;

        if (round1.allWords.length === 0) {
            io.to(roomId).emit("roundOver", round1.scores);
            setTimeout(() => io.to(roomId).emit("startRound2"), 5000);
        } else {
            io.to(roomId).emit("gameStateUpdate", round1);
        }
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected:", socket.id);
        const { roomId, id: playerId } = socket;
        if (!roomId || !rooms[roomId]) return;

        const room = rooms[roomId];
        delete room.players[playerId];
        room.teams.teamA = room.teams.teamA.filter((p) => p.id !== playerId);
        room.teams.teamB = room.teams.teamB.filter((p) => p.id !== playerId);

        io.to(roomId).emit("lobbyUpdate", room);
    });
});

let timers = {};
function startTurn(roomId) {
    const room = rooms[roomId];
    if (!room) return;

    io.to(roomId).emit("gameStateUpdate", room.round1);

    if (timers[roomId]) clearInterval(timers[roomId]);

    let timeLeft = 60;
    timers[roomId] = setInterval(() => {
        io.to(roomId).emit("timerUpdate", timeLeft);
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(timers[roomId]);
            room.round1.currentPlayerIndex = (room.round1.currentPlayerIndex + 1) % 4;
            room.round1.currentWord = null;
            startTurn(roomId);
        }
    }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
