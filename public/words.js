const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const playerName = urlParams.get("name");
const playerStorageKey = `shapka:${roomId}:playerId`;
const playerId = urlParams.get("playerId") || sessionStorage.getItem(playerStorageKey);

const wordsForm = document.getElementById("wordsForm");
const statusDiv = document.getElementById("status");
const submitButton = wordsForm.querySelector("button");

if (roomId && playerName && playerId) {
    socket.on("connect", () => socket.emit("joinRoom", { roomId, name: playerName, playerId }));
} else {
    statusDiv.textContent = "Error: Could not identify player or room.";
}

wordsForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const words = Array.from({ length: 10 }, (_, index) =>
        document.getElementById(`word${index + 1}`).value.trim()
    ).filter(Boolean);

    if (words.length !== 10) {
        statusDiv.textContent = "Please enter exactly ten non-empty words.";
        return;
    }

    socket.emit("submitWords", words);

    submitButton.disabled = true;
    submitButton.textContent = "Words Submitted!";
    statusDiv.textContent = "Your words have been submitted. Waiting for other players...";
});

socket.on("wordsUpdate", ({ submitted, total }) => {
    statusDiv.textContent = `Waiting for players... ${submitted}/${total} players have submitted their words.`;
});

socket.on("submitWordsError", (message) => {
    statusDiv.textContent = message;
    submitButton.disabled = false;
    submitButton.textContent = "Submit Words";
});

socket.on("submissionStatus", ({ submitted, submittedCount, total }) => {
    if (submitted) {
        submitButton.disabled = true;
        submitButton.textContent = "Words Submitted!";
        statusDiv.textContent = `Your words are submitted. Waiting for players... ${submittedCount}/${total}.`;
    }
});

socket.on("allWordsSubmitted", () => {
    window.location.href = `/game?roomId=${encodeURIComponent(roomId)}&name=${encodeURIComponent(playerName)}`;
});

socket.on("roomJoinError", (message) => {
    statusDiv.textContent = message;
    submitButton.disabled = true;
});
