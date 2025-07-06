document.addEventListener('DOMContentLoaded', () => {
    const audio = new Audio();
    let playlist = [];
    let originalPlaylist = [];
    let currentSongIndex = -1;
    let isPlaying = false;
    let repeatMode = 'none'; // 'none', 'one', 'all'
    let isShuffling = false;

    const fileInput = document.getElementById('fileInput');
    const loadFileButton = document.getElementById('loadFileButton');
    const clearPlaylistButton = document.getElementById('clearPlaylistButton');
    const playPauseButton = document.getElementById('playPauseButton');
    const prevButton = document.getElementById('prevButton');
    const nextButton = document.getElementById('nextButton');
    const repeatButton = document.getElementById('repeatButton');
    const shuffleButton = document.getElementById('shuffleButton');
    const currentSongTitle = document.getElementById('currentSongTitle');
    const playlistElement = document.getElementById('playlist');
    const infoButton = document.getElementById('infoButton');
    const infoOverlay = document.getElementById('infoOverlay');
    const closeInfo = document.getElementById('closeInfo');
    const artworkContainer = document.querySelector('.song-artwork');

    // Event Listeners
    loadFileButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFiles);
    clearPlaylistButton.addEventListener('click', clearPlaylist);
    playPauseButton.addEventListener('click', togglePlayPause);
    prevButton.addEventListener('click', playPrevSong);
    nextButton.addEventListener('click', playNextSong);
    repeatButton.addEventListener('click', toggleRepeatMode);
    shuffleButton.addEventListener('click', toggleShuffle);
    audio.addEventListener('ended', handleSongEnd);
    audio.addEventListener('play', () => {
        isPlaying = true;
        playPauseButton.innerHTML = '<i class="fas fa-pause"></i>';
    });
    audio.addEventListener('pause', () => {
        isPlaying = false;
        playPauseButton.innerHTML = '<i class="fas fa-play"></i>';
    });
    infoButton.addEventListener('click', () => infoOverlay.classList.add('show'));
    closeInfo.addEventListener('click', () => infoOverlay.classList.remove('show'));
    infoOverlay.addEventListener('click', (e) => {
        if (e.target === infoOverlay) {
            infoOverlay.classList.remove('show');
        }
    });

    function handleFiles(event) {
        const files = Array.from(event.target.files).filter(file => file.type === 'audio/mpeg');
        if (files.length === 0) return;

        if (playlist.length + files.length > 30) {
            alert('You can load up to 30 songs in total.');
            return;
        }

        const newSongs = files.map(file => ({
            name: file.name.replace('.mp3', ''),
            url: URL.createObjectURL(file),
            file: file,
            artwork: null
        }));

        playlist = [...playlist, ...newSongs];
        originalPlaylist = [...playlist];

        if (isShuffling) {
            shufflePlaylist();
        }

        updatePlaylistUI();
        updatePlayerControls();

        if (currentSongIndex === -1 && playlist.length > 0) {
            playSpecificSong(0);
        }
    }

    function updatePlaylistUI() {
        playlistElement.innerHTML = '';
        if (playlist.length === 0) {
            playlistElement.innerHTML = '<li class="empty-playlist-message">Add songs to get started</li>';
            currentSongTitle.textContent = 'No song selected';
            resetArtwork();
            return;
        }

        playlist.forEach((song, index) => {
            const listItem = document.createElement('li');
            listItem.textContent = song.name;
            if (index === currentSongIndex) {
                listItem.classList.add('active');
            }
            listItem.addEventListener('click', () => {
                playSpecificSong(index);
            });
            playlistElement.appendChild(listItem);
        });
    }

    function loadSong(index) {
        if (index < 0 || index >= playlist.length) return;
        currentSongIndex = index;
        const song = playlist[currentSongIndex];
        audio.src = song.url;
        currentSongTitle.textContent = song.name;
        updateArtwork(song);
        updatePlaylistUI();
    }

    function updateArtwork(song) {
        if (song.artwork) {
            artworkContainer.innerHTML = `<img src="${song.artwork}" alt="Artwork">`;
            return;
        }

        resetArtwork();

        window.jsmediatags.read(song.file, {
            onSuccess: function(tag) {
                const { data, format } = tag.tags.picture || {};
                if (data) {
                    let base64String = "";
                    for (let i = 0; i < data.length; i++) {
                        base64String += String.fromCharCode(data[i]);
                    }
                    const artworkUrl = `data:${format};base64,${window.btoa(base64String)}`;
                    song.artwork = artworkUrl;
                    artworkContainer.innerHTML = `<img src="${artworkUrl}" alt="Artwork">`;
                }
            },
            onError: function(error) {
                console.error('Error reading media tags:', error);
            }
        });
    }

    function resetArtwork() {
        artworkContainer.innerHTML = '<i class="fas fa-music default-icon"></i>';
    }

    function playSong() {
        if (currentSongIndex !== -1) {
            audio.play();
        }
    }

    function pauseSong() {
        audio.pause();
    }

    function togglePlayPause() {
        if (playlist.length === 0) return;
        if (isPlaying) {
            pauseSong();
        } else {
            if (currentSongIndex === -1) {
                playSpecificSong(0);
            } else {
                playSong();
            }
        }
    }

    function playSpecificSong(index) {
        loadSong(index);
        playSong();
    }

    function playPrevSong() {
        if (playlist.length === 0) return;
        let newIndex = currentSongIndex - 1;
        if (newIndex < 0) {
            newIndex = playlist.length - 1;
        }
        playSpecificSong(newIndex);
    }

    function playNextSong() {
        if (playlist.length === 0) return;
        let newIndex = currentSongIndex + 1;
        if (newIndex >= playlist.length) {
            newIndex = 0;
        }
        playSpecificSong(newIndex);
    }

    function handleSongEnd() {
        if (repeatMode === 'one') {
            playSong();
        } else if (repeatMode === 'all') {
            playNextSong();
        } else {
            if (currentSongIndex < playlist.length - 1) {
                playNextSong();
            } else {
                pauseSong();
                currentSongIndex = -1;
                updatePlaylistUI();
                currentSongTitle.textContent = 'No song selected';
                resetArtwork();
            }
        }
    }

    function toggleRepeatMode() {
        const icon = repeatButton.querySelector('i');
        if (repeatMode === 'none') {
            repeatMode = 'all';
            repeatButton.classList.add('active');
            icon.classList.remove('fa-sync-alt');
            icon.classList.add('fa-repeat');
        } else if (repeatMode === 'all') {
            repeatMode = 'one';
            repeatButton.classList.add('active');
            icon.classList.remove('fa-repeat');
            icon.classList.add('fa-repeat-1');
        } else {
            repeatMode = 'none';
            repeatButton.classList.remove('active');
            icon.classList.remove('fa-repeat-1');
            icon.classList.add('fa-sync-alt');
        }
    }


    function toggleShuffle() {
        isShuffling = !isShuffling;
        shuffleButton.classList.toggle('active', isShuffling);

        if (isShuffling) {
            shufflePlaylist();
        } else {
            unshufflePlaylist();
        }
        updatePlaylistUI();
    }

    function shufflePlaylist() {
        const currentSong = playlist[currentSongIndex];
        let tempPlaylist = [...originalPlaylist];
        if (currentSong) {
            tempPlaylist = tempPlaylist.filter(song => song.url !== currentSong.url);
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
        const currentSongUrl = playlist[currentSongIndex] ? playlist[currentSongIndex].url : null;
        playlist = [...originalPlaylist];
        if (currentSongUrl) {
            currentSongIndex = playlist.findIndex(song => song.url === currentSongUrl);
        }
    }

    function clearPlaylist() {
        playlist.forEach(song => {
            URL.revokeObjectURL(song.url);
        });
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
        prevButton.disabled = !hasSongs;
        nextButton.disabled = !hasSongs;
        playPauseButton.disabled = !hasSongs;
        clearPlaylistButton.disabled = !hasSongs;
        shuffleButton.disabled = !hasSongs;
        repeatButton.disabled = !hasSongs;
    }

    updatePlayerControls();
});