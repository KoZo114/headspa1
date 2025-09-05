const runners = Array.from(document.querySelectorAll('.runner'));
const startButton = document.getElementById('startButton');
const result = document.getElementById('result');
const guessSelect = document.getElementById('guess');

let animationFrameId = null;

function resetRace() {
  runners.forEach(r => {
    r.style.left = '0px';
  });
  result.textContent = '';
  cancelAnimationFrame(animationFrameId);
}

function startRace() {
  resetRace();
  startButton.disabled = true;
  const finish = document.getElementById('raceTrack').clientWidth - 40;
  const speeds = runners.map(() => 0);

  function step() {
    let winner = null;
    runners.forEach((runner, i) => {
      speeds[i] = Math.min(speeds[i] + Math.random() * 0.3, 6);
      let current = parseFloat(runner.style.left);
      current += speeds[i];
      runner.style.left = current + 'px';
      if (current >= finish && winner === null) {
        winner = i;
      }
    });
    if (winner !== null) {
      endRace(winner);
    } else {
      animationFrameId = requestAnimationFrame(step);
    }
  }

  animationFrameId = requestAnimationFrame(step);
}

function endRace(winnerIndex) {
  cancelAnimationFrame(animationFrameId);
  const guess = parseInt(guessSelect.value, 10);
  result.textContent = `勝者: キャラ ${winnerIndex + 1}. ${guess === winnerIndex ? '的中!' : 'はずれ'}`;
  startButton.disabled = false;
}

startButton.addEventListener('click', startRace);
