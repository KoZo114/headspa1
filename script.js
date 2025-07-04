document.addEventListener('DOMContentLoaded', async () => {
    // --- グローバル変数・定数の宣言 ---
    const audio = new Audio();
    let playlist = [];
    let originalPlaylist = []; // シャッフル前の元のプレイリスト
    let currentSongIndex = -1;
    let isPlaying = false;
    let repeatMode = 'none'; // 'none', 'one', 'all'
    let isShuffling = false;

    // --- DOM要素の取得 ---
    const fileInput = document.getElementById('fileInput');
    const loadFileButton = document.getElementById('loadFileButton');
    const playPauseButton = document.getElementById('playPauseButton');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const repeatButton = document.getElementById('repeatButton');
    const shuffleButton = document.getElementById('shuffleButton');
    const currentSongTitle = document.getElementById('currentSongTitle');
    const playlistElement = document.getElementById('playlist');
    const infoTrigger = document.getElementById('infoTrigger');
    const infoOverlay = document.getElementById('infoOverlay');
    const closeInfo = document.getElementById('closeInfo');
    const clearButton = document.getElementById('clearButton');

    // --- イベントリスナーの設定 ---
    loadFileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFiles);
    playPauseButton.addEventListener('click', togglePlayPause);
    prevButton.addEventListener('click', playPrevSong);
    nextButton.addEventListener('click', playNextSong);
    repeatButton.addEventListener('click', toggleRepeatMode);
    shuffleButton.addEventListener('click', toggleShuffle);
    if (clearButton) clearButton.addEventListener('click', clearPlaylist);
    audio.addEventListener('ended', handleSongEnd);
    audio.addEventListener('play', () => {
        isPlaying = true;
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
    });
    audio.addEventListener('pause', () => {
        isPlaying = false;
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
    });
    infoTrigger.addEventListener('click', () => infoOverlay.classList.add('show'));
    closeInfo.addEventListener('click', () => infoOverlay.classList.remove('show'));
    infoOverlay.addEventListener('click', (event) => {
        if (event.target === infoOverlay) {
            infoOverlay.classList.remove('show');
        }
    });

    // --- 初期化処理 ---
    await openDB();
    await loadSongsFromDB();
    updatePlayerControls();

    // --- 関数定義 ---

    async function loadSongsFromDB() {
        const songs = await getAllSongs();
        playlist = songs.map(song => ({
            ...song,
            url: URL.createObjectURL(song.file)
        }));
        originalPlaylist = [...playlist];
        updatePlaylistUI();
        updatePlayerControls();
    }

    async function handleFiles(event) {
        const files = Array.from(event.target.files).filter(file => {
            const type = file.type.toLowerCase();
            return type === 'audio/mpeg' || type === 'audio/mp3' || file.name.toLowerCase().endsWith('.mp3');
        });
        if (files.length === 0) return;

        if (playlist.length + files.length > 30) {
            alert('読み込める楽曲は合計30曲までです。');
            return;
        }

        for (const file of files) {
            const song = { name: file.name, file: file };
            const id = await addSong(song);
            playlist.push({ ...song, id, url: URL.createObjectURL(file) });
        }

        originalPlaylist = [...playlist];
        if (isShuffling) {
            shufflePlaylist();
        }

        updatePlaylistUI();

        if (currentSongIndex === -1 && playlist.length > 0) {
            currentSongIndex = 0;
            loadSong(currentSongIndex);
            playSong();
        } else if (playlist.length > 0 && !isPlaying) {
            loadSong(currentSongIndex);
        }
        updatePlayerControls();
    }

    function updatePlaylistUI() {
        playlistElement.innerHTML = '';
        if (playlist.length === 0) {
            playlistElement.innerHTML = '<li>Click "Load MP3 Files" to get started.</li>';
            if (currentSongTitle) {
                currentSongTitle.textContent = 'No song selected';
            }
            return;
        }

        playlist.forEach((song, index) => {
            const listItem = document.createElement('li');
            const titleSpan = document.createElement('span');
            titleSpan.textContent = song.name;
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-button';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeSong(index);
            });
            listItem.appendChild(titleSpan);
            listItem.appendChild(deleteBtn);
            if (index === currentSongIndex) {
                listItem.classList.add('active');
                if (currentSongTitle) {
                    currentSongTitle.textContent = song.name;
                }
            }
            listItem.addEventListener('click', () => {
                playSpecificSong(index);
            });
            playlistElement.appendChild(listItem);
        });
    }

    function loadSong(index) {
        if (index < 0 || index >= playlist.length) {
            audio.src = '';
            if (currentSongTitle) {
                currentSongTitle.textContent = 'No song selected';
            }
            return;
        }
        currentSongIndex = index;
        const song = playlist[currentSongIndex];
        // If the URL is revoked, create a new one
        if (!song.url.startsWith('blob:')) {
             song.url = URL.createObjectURL(song.file);
        }
        audio.src = song.url;
        updatePlaylistUI();
    }

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

    function playSong() {
        if (audio.src) {
            audio.play();
        }
    }

    function pauseSong() {
        audio.pause();
    }

    function playSpecificSong(index) {
        if (index === currentSongIndex && isPlaying) {
            pauseSong();
        } else if (index === currentSongIndex && !isPlaying) {
            playSong();
        } else {
            loadSong(index);
            playSong();
        }
        updatePlayerControls();
    }

    function playPrevSong() {
        if (playlist.length === 0) return;
        let newIndex = currentSongIndex - 1;
        if (newIndex < 0) {
            newIndex = playlist.length - 1;
        }
        loadSong(newIndex);
        playSong();
        updatePlayerControls();
    }

    function playNextSong() {
        if (playlist.length === 0) return;
        let newIndex = currentSongIndex + 1;
        if (newIndex >= playlist.length) {
            newIndex = 0;
        }
        loadSong(newIndex);
        playSong();
        updatePlayerControls();
    }

    function handleSongEnd() {
        if (repeatMode === 'one') {
            playSong();
        } else if (repeatMode === 'all') {
            playNextSong();
        } else {
            let nextIndex = currentSongIndex + 1;
            if (nextIndex < playlist.length) {
                playNextSong();
            } else {
                pauseSong();
                loadSong(-1);
                updatePlayerControls();
            }
        }
    }

    function toggleRepeatMode() {
        if (repeatMode === 'none') {
            repeatMode = 'one';
            repeatButton.innerHTML = '<i class="fas fa-sync-alt"></i><span class="mode-text">1曲</span>';
            repeatButton.classList.add('active');
        } else if (repeatMode === 'one') {
            repeatMode = 'all';
            repeatButton.innerHTML = '<i class="fas fa-sync-alt"></i><span class="mode-text">全曲</span>';
            repeatButton.classList.add('active');
        } else {
            repeatMode = 'none';
            repeatButton.innerHTML = '<i class="fas fa-sync-alt"></i><span class="mode-text">OFF</span>';
            repeatButton.classList.remove('active');
        }
        updatePlayerControls();
    }

    function toggleShuffle() {
        isShuffling = !isShuffling;
        if (isShuffling) {
            shuffleButton.innerHTML = '<i class="fas fa-random"></i><span class="mode-text">ON</span>';
            shuffleButton.classList.add('active');
            shufflePlaylist();
        } else {
            shuffleButton.innerHTML = '<i class="fas fa-random"></i><span class="mode-text">OFF</span>';
            shuffleButton.classList.remove('active');
            unshufflePlaylist();
        }
        updatePlaylistUI();
        updatePlayerControls();
    }

    function shufflePlaylist() {
        const currentSong = playlist[currentSongIndex];
        let tempPlaylist = [...originalPlaylist];
        if (currentSong) {
            tempPlaylist = tempPlaylist.filter(song => song.id !== currentSong.id);
        }
        for (let i = tempPlaylist.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [tempPlaylist[i], tempPlaylist[j]] = [tempPlaylist[j], tempPlaylist[i]];
        }
        if (currentSong) {
            playlist = [currentSong, ...tempPlaylist];
            currentSongIndex = 0;
        } else {
            playlist = tempPlaylist;
            currentSongIndex = -1;
        }
    }

    function unshufflePlaylist() {
        const currentSongId = playlist[currentSongIndex] ? playlist[currentSongIndex].id : null;
        playlist = [...originalPlaylist];
        if (currentSongId) {
            currentSongIndex = playlist.findIndex(song => song.id === currentSongId);
            if (currentSongIndex === -1) {
                currentSongIndex = 0;
            }
        } else {
            currentSongIndex = -1;
        }
    }

    async function removeSong(index) {
        const song = playlist[index];
        if (!song) return;

        URL.revokeObjectURL(song.url);
        await deleteSong(song.id);

        playlist.splice(index, 1);
        const originalIndex = originalPlaylist.findIndex(s => s.id === song.id);
        if (originalIndex !== -1) {
            originalPlaylist.splice(originalIndex, 1);
        }

        if (currentSongIndex === index) {
            pauseSong();
            currentSongIndex = -1;
        } else if (index < currentSongIndex) {
            currentSongIndex -= 1;
        }

        updatePlaylistUI();
        updatePlayerControls();
    }

    async function clearPlaylist() {
        playlist.forEach(song => URL.revokeObjectURL(song.url));
        await clearAllSongs();
        playlist = [];
        originalPlaylist = [];
        currentSongIndex = -1;
        pauseSong();
        audio.src = '';
        updatePlaylistUI();
        updatePlayerControls();
    }

    function updatePlayerControls() {
        const hasSongs = playlist.length > 0;
        if (playPauseButton) playPauseButton.disabled = !hasSongs;
        if (prevButton) prevButton.disabled = !hasSongs;
        if (nextButton) nextButton.disabled = !hasSongs;
        if (repeatButton) repeatButton.disabled = !hasSongs;
        if (shuffleButton) shuffleButton.disabled = !hasSongs;
        if (clearButton) clearButton.disabled = !hasSongs;

        if (currentSongTitle) {
            if (!hasSongs) {
                playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
                currentSongTitle.textContent = 'No song selected';
            } else if (audio.paused && currentSongIndex === -1) {
                playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
                currentSongTitle.textContent = 'No song selected';
            }
        }
    }
});
