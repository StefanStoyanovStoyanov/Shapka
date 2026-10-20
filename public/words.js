const socket = io();

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("roomId");
const name = urlParams.get("name");

const wordsForm = document.getElementById("wordsForm");
const statusDiv = document.getElementById("status");
const submitButton = wordsForm.querySelector("button");

if (roomId && name) {
    socket.emit("joinRoom", { roomId, name });
} else {
    statusDiv.textContent = "Error: Could not identify player or room.";
}

wordsForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const words = [
        document.getElementById("word1").value,
        document.getElementById("word2").value,
        document.getElementById("word3").value,
        document.getElementById("word4").value,
        document.getElementById("word5").value,
    ];

    socket.emit("submitWords", words);

    submitButton.disabled = true;
    submitButton.textContent = "Words Submitted!";
    statusDiv.textContent = "Your words have been submitted. Waiting for other players...";
});

socket.on("wordsUpdate", (count) => {
    statusDiv.textContent = `Waiting for players... ${count}/4 players have submitted their words.`;
});

socket.on("startRound1", () => {
    window.location.href = `/game.html?roomId=${roomId}&name=${encodeURIComponent(name)}`;
});
