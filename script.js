// --- グローバル変数・定数の宣言 ---
const audio = new Audio();
let playlist = [];
let originalPlaylist = []; // シャッフル前の元のプレイリスト
let currentSongIndex = -1;
let isPlaying = false;
let repeatMode = 'none'; // 'none', 'one', 'all'
let isShuffling = false;

// --- DOM要素の取得 ---
// プレイヤー関連のDOM要素
const fileInput = document.getElementById('fileInput');
const loadFileButton = document.getElementById('loadFileButton');
const playPauseButton = document.getElementById('playPauseButton');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const repeatButton = document.getElementById('repeatButton');
const shuffleButton = document.getElementById('shuffleButton');
const currentSongTitle = document.getElementById('currentSongTitle');
const playlistElement = document.getElementById('playlist');

// 情報オーバーレイ関連のDOM要素
const infoTrigger = document.getElementById('infoTrigger');
const infoOverlay = document.getElementById('infoOverlay');
const closeInfo = document.getElementById('closeInfo');


// --- イベントリスナーの設定 ---
// プレイヤー関連のイベント
loadFileButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
playPauseButton.addEventListener('click', togglePlayPause);
prevButton.addEventListener('click', playPrevSong);
nextButton.addEventListener('click', playNextSong);
repeatButton.addEventListener('click', toggleRepeatMode);
shuffleButton.addEventListener('click', toggleShuffle);

audio.addEventListener('ended', handleSongEnd);
audio.addEventListener('play', () => {
    isPlaying = true;
    playPauseButton.innerHTML = '<i class="fas fa-pause"></i>'; // ▶️ から ⏸️ に変更
});
audio.addEventListener('pause', () => {
    isPlaying = false;
    playPauseButton.innerHTML = '<i class="fas fa-play"></i>'; // ⏸️ から ▶️ に変更
});

// 情報オーバーレイ関連のイベント
infoTrigger.addEventListener('click', () => {
    infoOverlay.classList.add('show'); // オーバーレイを表示
});

closeInfo.addEventListener('click', () => {
    infoOverlay.classList.remove('show'); // オーバーレイを非表示
});

// オーバーレイの背景をクリックしても閉じるようにする (オプション)
infoOverlay.addEventListener('click', (event) => {
    // クリックされた要素がオーバーレイ自体であれば閉じる
    if (event.target === infoOverlay) {
        infoOverlay.classList.remove('show');
    }
});


// --- 初期化処理 ---
updatePlayerControls();


// --- 関数定義 ---

// ファイル読み込み処理
function handleFiles(event) {
    const files = Array.from(event.target.files).filter(file => file.type === 'audio/mpeg'); // MP3のみをフィルタ
    if (files.length === 0) return;

    if (playlist.length + files.length > 20) {
        alert('読み込める楽曲は合計20曲までです。');
        return;
    }

    // 新しい楽曲を既存のプレイリストに追加
    files.forEach(file => {
        playlist.push({
            name: file.name,
            file: file,
            url: URL.createObjectURL(file) // ローカルファイルURLを生成
        });
    });

    originalPlaylist = [...playlist]; // シャッフル前の状態を保存
    if (isShuffling) {
        shufflePlaylist();
    }

    updatePlaylistUI();

    // 初めてファイルを読み込んだら、最初の曲を自動再生（または選択）
    if (currentSongIndex === -1 && playlist.length > 0) {
        currentSongIndex = 0;
        loadSong(currentSongIndex);
        playSong();
    } else if (playlist.length > 0 && !isPlaying) {
        // ファイルを追加したが再生中でない場合、現在の選択を維持
        loadSong(currentSongIndex);
    }
    updatePlayerControls();
}

// プレイリストUIの更新
function updatePlaylistUI() {
    playlistElement.innerHTML = ''; // 一度クリア
    if (playlist.length === 0) {
        playlistElement.innerHTML = '<li>ファイルを選択してMP3を読み込んでください。</li>';
        currentSongTitle.textContent = '選択されていません';
        return;
    }

    playlist.forEach((song, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = song.name;
        if (index === currentSongIndex) {
            listItem.classList.add('active');
            currentSongTitle.textContent = song.name;
        }
        listItem.addEventListener('click', () => {
            playSpecificSong(index);
        });
        playlistElement.appendChild(listItem);
    });
}

// 曲の読み込み
function loadSong(index) {
    if (index < 0 || index >= playlist.length) {
        audio.src = '';
        currentSongTitle.textContent = '選択されていません';
        return;
    }
    currentSongIndex = index;
    audio.src = playlist[currentSongIndex].url;
    updatePlaylistUI(); // アクティブな曲を更新
}

// 再生/一時停止の切り替え
function togglePlayPause() {
    if (playlist.length === 0) {
        alert('まずMP3ファイルを読み込んでください。');
        return;
    }
    if (currentSongIndex === -1) {
        currentSongIndex = 0;
        loadSong(currentSongIndex);
    }
    if (audio.paused) {
        playSong();
    } else {
        pauseSong();
    }
    updatePlayerControls();
}

// 再生
function playSong() {
    if (audio.src) {
        audio.play();
    }
}

// 一時停止
function pauseSong() {
    audio.pause();
}

// 特定の曲を再生
function playSpecificSong(index) {
    if (index === currentSongIndex && isPlaying) {
        // 同じ曲で再生中なら一時停止
        pauseSong();
    } else if (index === currentSongIndex && !isPlaying) {
        // 同じ曲で一時停止中なら再生
        playSong();
    } else {
        // 別の曲を再生
        loadSong(index);
        playSong();
    }
    updatePlayerControls();
}

// 前の曲を再生
function playPrevSong() {
    if (playlist.length === 0) return;
    let newIndex = currentSongIndex - 1;
    if (newIndex < 0) {
        newIndex = playlist.length - 1; // プレイリストの最後にループ
    }
    loadSong(newIndex);
    playSong();
    updatePlayerControls();
}

// 次の曲を再生
function playNextSong() {
    if (playlist.length === 0) return;
    let newIndex = currentSongIndex + 1;
    if (newIndex >= playlist.length) {
        newIndex = 0; // プレイリストの最初にループ
    }
    loadSong(newIndex);
    playSong();
    updatePlayerControls();
}

// 曲の再生終了時の処理
function handleSongEnd() {
    if (repeatMode === 'one') {
        playSong(); // 同じ曲をリピート
    } else if (repeatMode === 'all') {
        playNextSong(); // 次の曲へ、プレイリスト全体をリピート
    } else {
        // リピートなしの場合
        let nextIndex = currentSongIndex + 1;
        if (nextIndex < playlist.length) {
            playNextSong();
        } else {
            // プレイリストの最後まできたら停止
            pauseSong();
            loadSong(-1); // 現在の曲をリセット
            updatePlayerControls();
        }
    }
}

// リピートモードの切り替え
function toggleRepeatMode() {
    if (repeatMode === 'none') {
        repeatMode = 'one';
        repeatButton.innerHTML = '<i class="fas fa-redo-alt"></i> リピート: 1曲';
        repeatButton.classList.add('active');
    } else if (repeatMode === 'one') {
        repeatMode = 'all';
        repeatButton.innerHTML = '<i class="fas fa-redo-alt"></i> リピート: 全曲';
        repeatButton.classList.add('active');
    } else {
        repeatMode = 'none';
        repeatButton.innerHTML = '<i class="fas fa-redo-alt"></i> リピート: OFF';
        repeatButton.classList.remove('active');
    }
    updatePlayerControls();
}

// シャッフル機能の切り替え
function toggleShuffle() {
    isShuffling = !isShuffling;
    if (isShuffling) {
        shuffleButton.innerHTML = '<i class="fas fa-random"></i> シャッフル: ON';
        shuffleButton.classList.add('active');
        shufflePlaylist();
    } else {
        shuffleButton.innerHTML = '<i class="fas fa-random"></i> シャッフル: OFF';
        shuffleButton.classList.remove('active');
        unshufflePlaylist();
    }
    updatePlaylistUI(); // UIを更新して曲順を反映
    updatePlayerControls();
}

// プレイリストをシャッフル
function shufflePlaylist() {
    // 現在再生中の曲を一時的に保存
    const currentSong = playlist[currentSongIndex];

    // シャッフル対象から現在の曲を除外してシャッフル
    let tempPlaylist = [...originalPlaylist];
    if (currentSong) {
        tempPlaylist = tempPlaylist.filter(song => song.url !== currentSong.url);
    }
    
    for (let i = tempPlaylist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tempPlaylist[i], tempPlaylist[j]] = [tempPlaylist[j], tempPlaylist[i]];
    }

    // シャッフルされたリストの先頭に現在の曲を戻す (あれば)
    if (currentSong) {
        playlist = [currentSong, ...tempPlaylist];
        currentSongIndex = 0; // 現在の曲が先頭になる
    } else {
        playlist = tempPlaylist;
        currentSongIndex = -1; // 曲がない場合
    }
}

// プレイリストを元に戻す
function unshufflePlaylist() {
    const currentSongUrl = playlist[currentSongIndex] ? playlist[currentSongIndex].url : null;
    playlist = [...originalPlaylist]; // 元の順序に戻す

    // 元の順序に戻った後、現在の曲のインデックスを再設定
    if (currentSongUrl) {
        currentSongIndex = playlist.findIndex(song => song.url === currentSongUrl);
        if (currentSongIndex === -1) { // 見つからない場合は先頭か最後
            currentSongIndex = 0;
        }
    } else {
        currentSongIndex = -1;
    }
}

// プレイヤーコントロールの状態更新
function updatePlayerControls() {
    const hasSongs = playlist.length > 0;

    playPauseButton.disabled = !hasSongs;
    prevButton.disabled = !hasSongs;
    nextButton.disabled = !hasSongs;
    repeatButton.disabled = !hasSongs;
    shuffleButton.disabled = !hasSongs;

    if (!hasSongs) {
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>'; // 曲がない場合は再生アイコン
        currentSongTitle.textContent = 'ファイルを選択してください';
    } else if (audio.paused && currentSongIndex === -1) {
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>'; // 選択なしで停止中は再生アイコン
        currentSongTitle.textContent = '選択されていません';
    }
}
