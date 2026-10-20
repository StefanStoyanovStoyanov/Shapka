const crypto = require("crypto");
const express = require("express");
const http = require("http");
const path = require("path");
const socketIo = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new socketIo.Server(server);
const rooms = {};

function createRoom(teamCount, adminId, adminName) {
    const teams = Array.from({ length: teamCount }, (_, index) => ({
        id: `team-${index + 1}`,
        name: `Team ${index + 1}`,
        players: [],
    }));
    teams[0].players.push({ id: adminId, name: adminName });

    return {
        adminId,
        players: { [adminId]: adminName },
        teams,
        words: {},
        phase: "lobby",
    };
}

function sanitizeWords(input) {
    if (!Array.isArray(input)) return [];
    return input
        .filter((word) => typeof word === "string")
        .map((word) => word.trim())
        .filter(Boolean);
}

function getTeam(room, playerId) {
    return room.teams.find((team) => team.players.some((player) => player.id === playerId));
}

function getPublicRoom(room) {
    return {
        adminId: room.adminId,
        teams: room.teams,
        players: Object.entries(room.players).map(([id, name]) => ({ id, name })),
        playerCount: Object.keys(room.players).length,
        submittedCount: Object.keys(room.words).length,
        phase: room.phase,
    };
}

function emitLobbyState(roomId) {
    const room = rooms[roomId];
    if (room) io.to(roomId).emit("lobbyUpdate", getPublicRoom(room));
}

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/lobby", (req, res) => res.sendFile(path.join(__dirname, "public", "lobby.html")));
app.get("/words", (req, res) => res.sendFile(path.join(__dirname, "public", "words.html")));
app.get("/game", (req, res) => res.sendFile(path.join(__dirname, "public", "game.html")));
app.get("/game.html", (req, res) => res.sendFile(path.join(__dirname, "public", "game.html")));

io.on("connection", (socket) => {
    socket.on("createRoom", ({ name, teamCount, playerId } = {}) => {
        const trimmedName = typeof name === "string" ? name.trim() : "";
        const validTeamCount = Number.isInteger(teamCount) && teamCount >= 2 && teamCount <= 50;
        const validPlayerId = typeof playerId === "string" && playerId.length > 0 && playerId.length <= 100;

        if (!trimmedName || trimmedName.length > 40 || !validTeamCount || !validPlayerId) {
            socket.emit("roomCreationError", "Enter a name and choose between 2 and 50 teams.");
            return;
        }

        let roomId;
        do {
            roomId = crypto.randomBytes(3).toString("hex").toUpperCase();
        } while (rooms[roomId]);

        rooms[roomId] = createRoom(teamCount, playerId, trimmedName);
        socket.emit("roomCreated", { roomId });
    });

    socket.on("joinRoom", ({ roomId, name, playerId } = {}) => {
        const trimmedName = typeof name === "string" ? name.trim() : "";
        if (
            typeof roomId !== "string" ||
            !roomId.trim() ||
            !trimmedName ||
            trimmedName.length > 40 ||
            typeof playerId !== "string" ||
            !playerId.length ||
            playerId.length > 100
        ) {
            socket.emit("roomJoinError", "Enter a valid room code and name.");
            return;
        }

        const normalizedRoomId = roomId.trim().toUpperCase();
        const room = rooms[normalizedRoomId];
        if (!room) {
            socket.emit("roomJoinError", "That room could not be found.");
            return;
        }
        if (room.phase !== "lobby" && !room.players[playerId]) {
            socket.emit("roomJoinError", "This room has already started.");
            return;
        }

        if (socket.roomId && socket.roomId !== normalizedRoomId) {
            socket.leave(socket.roomId);
        }

        socket.join(normalizedRoomId);
        socket.roomId = normalizedRoomId;
        socket.playerId = playerId;
        socket.name = trimmedName;
        room.players[playerId] = trimmedName;

        if (room.phase === "lobby") {
            emitLobbyState(normalizedRoomId);
        } else if (room.phase === "submitting") {
            socket.emit("submissionStatus", {
                submitted: Boolean(room.words[playerId]),
                submittedCount: Object.keys(room.words).length,
                total: Object.keys(room.players).length,
            });
        } else if (room.phase === "complete") {
            socket.emit("allWordsSubmitted");
        }
    });

    socket.on("joinTeam", (teamId) => {
        const { roomId, playerId } = socket;
        const room = roomId && rooms[roomId];
        if (!room || room.phase !== "lobby" || !room.players[playerId]) return;

        const targetTeam = room.teams.find((team) => team.id === teamId);
        if (!targetTeam) return;

        for (const team of room.teams) {
            team.players = team.players.filter((player) => player.id !== playerId);
        }
        targetTeam.players.push({ id: playerId, name: room.players[playerId] });
        emitLobbyState(roomId);
    });

    socket.on("removeFromTeam", (targetPlayerId) => {
        const { roomId, playerId } = socket;
        const room = roomId && rooms[roomId];
        if (!room || room.phase !== "lobby" || playerId !== room.adminId) return;

        for (const team of room.teams) {
            team.players = team.players.filter((player) => player.id !== targetPlayerId);
        }
        emitLobbyState(roomId);
    });

    socket.on("startGame", () => {
        const { roomId, playerId } = socket;
        const room = roomId && rooms[roomId];
        if (!room || room.phase !== "lobby" || playerId !== room.adminId) return;

        const allPlayersAssigned = Object.keys(room.players).every((id) => getTeam(room, id));
        if (!allPlayersAssigned || room.teams.some((team) => team.players.length === 0)) {
            socket.emit("startGameError", "Assign every player to a team, and make sure every team has at least one player.");
            return;
        }

        room.phase = "submitting";
        io.to(roomId).emit("startWordSubmission");
    });

    socket.on("submitWords", (submittedWords) => {
        const { roomId, playerId } = socket;
        const room = roomId && rooms[roomId];
        if (!room || room.phase !== "submitting" || !room.players[playerId] || !getTeam(room, playerId)) return;

        const words = sanitizeWords(submittedWords);
        if (words.length !== 10) {
            socket.emit("submitWordsError", "Please submit exactly ten non-empty words.");
            return;
        }

        room.words[playerId] = words;
        const playerCount = Object.keys(room.players).length;
        io.to(roomId).emit("wordsUpdate", {
            submitted: Object.keys(room.words).length,
            total: playerCount,
        });

        if (Object.keys(room.words).length === playerCount) {
            room.phase = "complete";
            io.to(roomId).emit("allWordsSubmitted");
        }
    });

    socket.on("disconnect", () => {
        const { roomId, playerId } = socket;
        const room = roomId && rooms[roomId];
        if (!room || room.phase !== "lobby") return;

        delete room.players[playerId];
        for (const team of room.teams) {
            team.players = team.players.filter((player) => player.id !== playerId);
        }

        emitLobbyState(roomId);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
