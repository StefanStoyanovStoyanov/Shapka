// public/lobby.js - WHOLE FILE
const socket = io();

// Read both 'roomId' and 'name' from the URL.
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const name = urlParams.get("name");

// Get references to HTML elements.
const roomTitle = document.getElementById("roomTitle");
const joinTeamAButton = document.getElementById("joinTeamA");
const joinTeamBButton = document.getElementById("joinTeamB");
const statusDiv = document.getElementById("status");
const teamASlots = [document.getElementById("teamA_slot1"), document.getElementById("teamA_slot2")];
const teamBSlots = [document.getElementById("teamB_slot1"), document.getElementById("teamB_slot2")];

if (roomId && name) {
    roomTitle.innerText = `Lobby for Room: ${roomId}`;
    // Emit an object with both roomId and name.
    socket.emit("joinRoom", { roomId, name });
} else {
    roomTitle.innerText = "Error: Room ID or Name is missing!";
}

// --- Client Actions (Emitting Events) ---
joinTeamAButton.addEventListener("click", () => socket.emit("joinTeam", "teamA"));
joinTeamBButton.addEventListener("click", () => socket.emit("joinTeam", "teamB"));

// --- Server Responses (Listening for Events) ---
socket.on("lobbyUpdate", (room) => {
    const updateTeamSlots = (slots, teamMembers) => {
        slots.forEach((slot, index) => {
            const player = teamMembers[index];
            if (player) {
                slot.textContent = player.name; // Display player's name
                slot.classList.add("filled");
            } else {
                slot.textContent = "Empty";
                slot.classList.remove("filled");
            }
        });
    };

    updateTeamSlots(teamASlots, room.teams.teamA);
    updateTeamSlots(teamBSlots, room.teams.teamB);

    const playersNeeded = 4 - (room.teams.teamA.length + room.teams.teamB.length);
    if (playersNeeded > 0) {
        statusDiv.textContent = `Waiting for ${playersNeeded} more player(s)...`;
    } else {
        statusDiv.textContent = "Teams are full! Preparing for next phase...";
        joinTeamAButton.disabled = true;
        joinTeamBButton.disabled = true;
    }
});

socket.on("startWordSubmission", () => {
    // Pass the name to the next page as well, in case it's needed.
    window.location.href = `/words?roomId=${roomId}&name=${encodeURIComponent(name)}`;
});
