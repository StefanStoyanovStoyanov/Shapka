const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const name = urlParams.get("name");

const roomTitle = document.getElementById("roomTitle");
const joinTeamAButton = document.getElementById("joinTeamA");
const joinTeamBButton = document.getElementById("joinTeamB");
const statusDiv = document.getElementById("status");
const teamASlots = [document.getElementById("teamA_slot1"), document.getElementById("teamA_slot2")];
const teamBSlots = [document.getElementById("teamB_slot1"), document.getElementById("teamB_slot2")];

if (roomId && name) {
    roomTitle.innerText = `Lobby for Room: ${roomId}`;
    socket.emit("joinRoom", { roomId, name });
} else {
    roomTitle.innerText = "Error: Room ID or Name is missing!";
}

joinTeamAButton.addEventListener("click", () => socket.emit("joinTeam", "teamA"));
joinTeamBButton.addEventListener("click", () => socket.emit("joinTeam", "teamB"));

socket.on("lobbyUpdate", (room) => {
    const updateTeamSlots = (slots, teamMembers) => {
        slots.forEach((slot, index) => {
            const player = teamMembers[index];
            if (player) {
                slot.textContent = player.name;
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
    window.location.href = `/words?roomId=${roomId}&name=${encodeURIComponent(name)}`;
});
