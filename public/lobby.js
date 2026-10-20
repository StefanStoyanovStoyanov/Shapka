const socket = io();
const params = new URLSearchParams(window.location.search);
const roomId = params.get("roomId");
const playerName = params.get("name");
const playerStorageKey = `shapka:${roomId}:playerId`;
const playerId = params.get("playerId") || sessionStorage.getItem(playerStorageKey);

const roomTitle = document.getElementById("roomTitle");
const adminNotice = document.getElementById("adminNotice");
const teamsContainer = document.getElementById("teams");
const startGameButton = document.getElementById("startGame");
const statusDiv = document.getElementById("status");

if (!roomId || !playerName || !playerId) {
    roomTitle.textContent = "Room details are missing.";
    statusDiv.textContent = "Return to the home page and join or create a room.";
} else {
    sessionStorage.setItem(playerStorageKey, playerId);
    socket.on("connect", () => socket.emit("joinRoom", { roomId, name: playerName, playerId }));
}

startGameButton.addEventListener("click", () => socket.emit("startGame"));

socket.on("lobbyUpdate", (room) => {
    const isAdmin = room.adminId === playerId;
    const assignedPlayerIds = new Set();
    teamsContainer.replaceChildren();
    roomTitle.textContent = `Room ${roomId}`;
    adminNotice.textContent = isAdmin ? "You are the room admin." : "Waiting for the room admin to start.";

    for (const team of room.teams) {
        const card = document.createElement("section");
        card.className = "team-card";

        const heading = document.createElement("h2");
        heading.textContent = team.name;
        card.append(heading);

        for (const player of team.players) {
            assignedPlayerIds.add(player.id);
            const row = document.createElement("div");
            row.className = "player";
            const playerLabel = document.createElement("span");
            playerLabel.textContent = player.name;
            row.append(playerLabel);

            if (isAdmin) {
                const removeButton = document.createElement("button");
                removeButton.type = "button";
                removeButton.textContent = "Remove";
                removeButton.setAttribute("aria-label", `Remove ${player.name} from ${team.name}`);
                removeButton.addEventListener("click", () => socket.emit("removeFromTeam", player.id));
                row.append(removeButton);
            }
            card.append(row);
        }

        if (room.phase === "lobby") {
            const joinButton = document.createElement("button");
            joinButton.type = "button";
            joinButton.textContent = "Join this team";
            joinButton.disabled = team.players.some((player) => player.id === playerId);
            joinButton.addEventListener("click", () => socket.emit("joinTeam", team.id));
            card.append(joinButton);
        }
        teamsContainer.append(card);
    }

    const allPlayerIds = room.players.map((player) => player.id);
    const unassigned = room.players.filter((player) => !assignedPlayerIds.has(player.id));
    if (unassigned.length) {
        const unassignedCard = document.createElement("section");
        unassignedCard.className = "team-card";
        const heading = document.createElement("h2");
        heading.textContent = "Not on a team";
        unassignedCard.append(heading);
        for (const player of unassigned) {
            const row = document.createElement("div");
            row.className = "player";
            row.textContent = player.name;
            unassignedCard.append(row);
        }
        teamsContainer.append(unassignedCard);
    }

    const everyTeamHasPlayers = room.teams.every((team) => team.players.length > 0);
    const everyoneAssigned = allPlayerIds.every((id) => assignedPlayerIds.has(id));
    statusDiv.textContent =
        `${room.playerCount} player(s) · ${room.teams.length} teams` +
        (room.phase === "lobby" ? " · Assign everyone and fill every team before starting." : "");

    startGameButton.hidden = !isAdmin || room.phase !== "lobby";
    startGameButton.disabled = !everyTeamHasPlayers || !everyoneAssigned;
});

socket.on("startWordSubmission", () => {
    window.location.href = `/words?roomId=${encodeURIComponent(roomId)}&name=${encodeURIComponent(playerName)}&playerId=${encodeURIComponent(playerId)}`;
});

socket.on("startGameError", (message) => {
    statusDiv.textContent = message;
});

socket.on("roomJoinError", (message) => {
    roomTitle.textContent = "Could not join room";
    statusDiv.textContent = message;
});
