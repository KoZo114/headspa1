const runners = Array.from(document.querySelectorAll('.runner'));
const startButton = document.getElementById('startButton');
const result = document.getElementById('result');
const guessSelect = document.getElementById('guess');

let intervalId = null;

function resetRace() {
  runners.forEach(r => {
    r.style.left = '0px';
  });
  result.textContent = '';
}

function startRace() {
  resetRace();
  startButton.disabled = true;
  const finish = document.getElementById('raceTrack').clientWidth - 40;
  const speeds = runners.map(() => Math.random() * 2 + 1);
  intervalId = setInterval(() => {
    runners.forEach((runner, i) => {
      let current = parseFloat(runner.style.left);
      current += speeds[i];
      runner.style.left = current + 'px';
      if (current >= finish) {
        endRace(i);
      }
    });
  }, 16);
}

function endRace(winnerIndex) {
  clearInterval(intervalId);
  const guess = parseInt(guessSelect.value, 10);
  result.textContent = `勝者: キャラ ${winnerIndex + 1}. ${guess === winnerIndex ? '的中!' : 'はずれ'}`;
  startButton.disabled = false;
}

startButton.addEventListener('click', startRace);
