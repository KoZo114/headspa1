const scenePresets = {
    training: { lineLength: 30, minPageDuration: 1.8, silenceThreshold: 0.012, silenceDuration: 5, label: '新卒研修 / 講義' },
    youtube: { lineLength: 26, minPageDuration: 1.5, silenceThreshold: 0.015, silenceDuration: 2.4, label: '社内 YouTube' },
    webinar: { lineLength: 25, minPageDuration: 1.7, silenceThreshold: 0.013, silenceDuration: 4, label: 'ウェビナー記録' },
    shorts: { lineLength: 15, minPageDuration: 1.2, silenceThreshold: 0.018, silenceDuration: 1.2, label: 'Shorts / Reels' }
};

const fillerDictionaries = {
    default: ['えーっと', 'えっと', 'あの', 'まあ', 'その'],
    lecturerA: ['えーっと', 'あの', 'まあ', 'ですね'],
    lecturerB: ['なんていうか', 'そう、まあ', '要するに', 'ですね']
};

const protectedTerms = ['Claude Code', 'NoLang', 'Silero VAD', 'BudouX', 'WhisperX', 'ElevenLabs'];

const sampleTranscript = `0.0|4.2|えーっと 本日は Claude Code を使った動画編集の自動化について説明します。
4.2|9.6|業務動画では文字起こし 無音カット テロップ改行 ページング 書き出しが大きな負担になります。
9.6|15.8|NoLang のような SaaS も便利ですが 自社のブランドルールに合わせたい場合は決定論的な処理が重要です。
15.8|22.5|BudouX で自然な区切り候補を作り 動的計画法で見やすい改行を選びます。
22.5|29.0|Silero VAD の結果は業務シーン別のしきい値で扱い 講師の考え込みは残します。
29.0|35.0|最後に SRT と編集 JSON と ffmpeg の書き出しコマンドを生成します。`;

const state = {
    mediaFile: null,
    mediaUrl: null,
    captions: [],
    silenceCuts: []
};

const elements = {
    videoInput: document.getElementById('videoInput'),
    videoPreview: document.getElementById('videoPreview'),
    fileMeta: document.getElementById('fileMeta'),
    loadSampleButton: document.getElementById('loadSampleButton'),
    sceneSelect: document.getElementById('sceneSelect'),
    speakerSelect: document.getElementById('speakerSelect'),
    lineLengthInput: document.getElementById('lineLengthInput'),
    minDurationInput: document.getElementById('minDurationInput'),
    silenceThresholdInput: document.getElementById('silenceThresholdInput'),
    silenceDurationInput: document.getElementById('silenceDurationInput'),
    removeCommaInput: document.getElementById('removeCommaInput'),
    removePeriodInput: document.getElementById('removePeriodInput'),
    protectTermsInput: document.getElementById('protectTermsInput'),
    transcriptInput: document.getElementById('transcriptInput'),
    processButton: document.getElementById('processButton'),
    downloadSrtButton: document.getElementById('downloadSrtButton'),
    downloadJsonButton: document.getElementById('downloadJsonButton'),
    summaryCards: document.getElementById('summaryCards'),
    pipelineList: document.getElementById('pipelineList'),
    captionPreview: document.getElementById('captionPreview'),
    ffmpegCommand: document.getElementById('ffmpegCommand')
};

elements.videoInput.addEventListener('change', handleMediaLoad);
elements.loadSampleButton.addEventListener('click', () => {
    elements.transcriptInput.value = sampleTranscript;
    processPipeline();
});
elements.sceneSelect.addEventListener('change', applyScenePreset);
elements.processButton.addEventListener('click', processPipeline);
elements.downloadSrtButton.addEventListener('click', () => downloadText('captions.srt', buildSrt(state.captions)));
elements.downloadJsonButton.addEventListener('click', () => downloadText('edit-decision-list.json', JSON.stringify(buildEditDecisionList(), null, 2)));

applyScenePreset();
renderEmptyState();

function applyScenePreset() {
    const preset = scenePresets[elements.sceneSelect.value];
    elements.lineLengthInput.value = preset.lineLength;
    elements.minDurationInput.value = preset.minPageDuration;
    elements.silenceThresholdInput.value = preset.silenceThreshold;
    elements.silenceDurationInput.value = preset.silenceDuration;
}

function handleMediaLoad(event) {
    const [file] = event.target.files;
    if (!file) return;

    if (state.mediaUrl) URL.revokeObjectURL(state.mediaUrl);
    state.mediaFile = file;
    state.mediaUrl = URL.createObjectURL(file);
    elements.videoPreview.src = state.mediaUrl;
    elements.fileMeta.textContent = `${file.name} / ${formatBytes(file.size)} / ${file.type || 'unknown type'}`;
    detectSilence(file);
}

async function detectSilence(file) {
    state.silenceCuts = [];
    updatePipelineStatus('音声解析中: Web Audio API で簡易RMS無音検出を実行しています。');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioContext = new AudioContextClass();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        const cuts = findSilentRanges(audioBuffer, Number(elements.silenceThresholdInput.value), Number(elements.silenceDurationInput.value));
        state.silenceCuts = cuts;
        await audioContext.close();
        updatePipelineStatus(`無音検出完了: ${cuts.length} 件のカット候補を検出しました。`);
    } catch (error) {
        updatePipelineStatus('無音検出はスキップされました。ブラウザがこのコーデックをデコードできない可能性があります。');
    }
}

function findSilentRanges(audioBuffer, threshold, minDuration) {
    const channel = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const windowSize = Math.floor(sampleRate * 0.1);
    const ranges = [];
    let silenceStart = null;

    for (let index = 0; index < channel.length; index += windowSize) {
        const end = Math.min(index + windowSize, channel.length);
        let sum = 0;
        for (let cursor = index; cursor < end; cursor += 1) {
            sum += channel[cursor] * channel[cursor];
        }
        const rms = Math.sqrt(sum / Math.max(1, end - index));
        const time = index / sampleRate;

        if (rms < threshold && silenceStart === null) {
            silenceStart = time;
        }
        if ((rms >= threshold || end === channel.length) && silenceStart !== null) {
            const silenceEnd = time;
            if (silenceEnd - silenceStart >= minDuration) {
                ranges.push({ start: roundTime(silenceStart), end: roundTime(silenceEnd), duration: roundTime(silenceEnd - silenceStart) });
            }
            silenceStart = null;
        }
    }

    return ranges;
}

function processPipeline() {
    const transcript = elements.transcriptInput.value.trim();
    if (!transcript) {
        alert('文字起こしテキストを入力するか、サンプル字幕を投入してください。');
        return;
    }

    const config = getConfig();
    const segments = parseTranscript(transcript);
    const fillerRemoved = segments.map(segment => ({
        ...segment,
        text: removeFillers(segment.text, fillerDictionaries[config.speaker])
    }));
    const captions = paginateCaptions(fillerRemoved, config).map((caption, index) => ({
        ...caption,
        index: index + 1,
        displayText: applyPunctuationPolicy(caption.displayText, config)
    }));

    state.captions = captions;
    renderResults(segments, fillerRemoved, captions, config);
}

function getConfig() {
    return {
        scene: elements.sceneSelect.value,
        sceneLabel: scenePresets[elements.sceneSelect.value].label,
        speaker: elements.speakerSelect.value,
        lineLength: Number(elements.lineLengthInput.value),
        minPageDuration: Number(elements.minDurationInput.value),
        silenceThreshold: Number(elements.silenceThresholdInput.value),
        silenceDuration: Number(elements.silenceDurationInput.value),
        removeComma: elements.removeCommaInput.checked,
        removePeriod: elements.removePeriodInput.checked,
        protectTerms: elements.protectTermsInput.checked
    };
}

function parseTranscript(transcript) {
    return transcript.split('\n').filter(Boolean).map((line, index) => {
        const parts = line.split('|');
        if (parts.length >= 3 && !Number.isNaN(Number(parts[0])) && !Number.isNaN(Number(parts[1]))) {
            return { start: Number(parts[0]), end: Number(parts[1]), text: parts.slice(2).join('|').trim() };
        }
        const start = index * 4;
        return { start, end: start + 4, text: line.trim() };
    });
}

function removeFillers(text, fillers) {
    return fillers.reduce((result, filler) => {
        const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return result.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), ' ').replace(/\s+/g, ' ').trim();
    }, text);
}

function paginateCaptions(segments, config) {
    const captions = [];

    segments.forEach(segment => {
        const protectedText = config.protectTerms ? protectBusinessTerms(segment.text) : { text: segment.text, restore: value => value };
        const lines = chooseBestLineBreaks(protectedText.text, config.lineLength).map(protectedText.restore);
        const pages = splitLinesIntoPages(lines, 2);
        const duration = Math.max(config.minPageDuration, segment.end - segment.start);
        const pageDuration = duration / pages.length;

        pages.forEach((page, pageIndex) => {
            captions.push({
                start: roundTime(segment.start + pageDuration * pageIndex),
                end: roundTime(pageIndex === pages.length - 1 ? segment.end : segment.start + pageDuration * (pageIndex + 1)),
                displayText: page.join('\n')
            });
        });
    });

    return mergeTooShortCaptions(captions, config.minPageDuration, config.lineLength);
}

function protectBusinessTerms(text) {
    const replacements = new Map();
    let protectedText = text;
    protectedTerms.forEach((term, index) => {
        const token = `__TERM_${index}__`;
        replacements.set(token, term);
        protectedText = protectedText.replaceAll(term, token);
    });
    return {
        text: protectedText,
        restore: value => Array.from(replacements.entries()).reduce((result, [token, term]) => result.replaceAll(token, term), value)
    };
}

function chooseBestLineBreaks(text, maxLength) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return [normalized];

    const candidates = buildBreakCandidates(normalized, maxLength);
    const dp = Array(normalized.length + 1).fill(Infinity);
    const prev = Array(normalized.length + 1).fill(-1);
    dp[0] = 0;

    for (let start = 0; start < normalized.length; start += 1) {
        if (!Number.isFinite(dp[start])) continue;
        candidates.filter(end => end > start && end - start <= maxLength).forEach(end => {
            const line = normalized.slice(start, end).trim();
            if (!line) return;
            const score = dp[start] + scoreLine(line, maxLength, end === normalized.length);
            if (score < dp[end]) {
                dp[end] = score;
                prev[end] = start;
            }
        });
    }

    if (prev[normalized.length] === -1) return greedyBreak(normalized, maxLength);

    const lines = [];
    let cursor = normalized.length;
    while (cursor > 0) {
        const start = prev[cursor];
        lines.unshift(normalized.slice(start, cursor).trim());
        cursor = start;
    }
    return lines;
}

function buildBreakCandidates(text, maxLength) {
    const candidates = new Set([text.length]);
    const punctuation = new Set(['、', '。', ' ', '　', ',', '.', '!', '?', '！', '？']);
    for (let index = 1; index < text.length; index += 1) {
        if (punctuation.has(text[index - 1]) || punctuation.has(text[index])) candidates.add(index);
        if (index % maxLength === 0) candidates.add(index);
        if ([...candidates].every(candidate => Math.abs(candidate - index) > 4) && index % Math.floor(maxLength * 0.75) === 0) candidates.add(index);
    }
    return [...candidates].sort((a, b) => a - b);
}

function scoreLine(line, maxLength, isLastLine) {
    const ideal = maxLength * 0.82;
    const raggedPenalty = Math.pow(ideal - line.length, 2);
    const overflowPenalty = line.length > maxLength ? 10000 : 0;
    const punctuationPenalty = /^[、。，,.]/.test(line) || /[「（(]$/.test(line) ? 80 : 0;
    const shortLastPenalty = isLastLine && line.length < maxLength * 0.35 ? 60 : 0;
    return raggedPenalty + overflowPenalty + punctuationPenalty + shortLastPenalty;
}

function greedyBreak(text, maxLength) {
    const lines = [];
    for (let cursor = 0; cursor < text.length; cursor += maxLength) {
        lines.push(text.slice(cursor, cursor + maxLength).trim());
    }
    return lines;
}

function splitLinesIntoPages(lines, linesPerPage) {
    const pages = [];
    for (let index = 0; index < lines.length; index += linesPerPage) {
        pages.push(lines.slice(index, index + linesPerPage));
    }
    return pages;
}

function mergeTooShortCaptions(captions, minDuration, lineLength) {
    return captions.reduce((merged, caption) => {
        const last = merged[merged.length - 1];
        const canMerge = last && caption.end - caption.start < minDuration && `${last.displayText}\n${caption.displayText}`.replace(/\n/g, '').length <= lineLength * 2;
        if (canMerge) {
            last.end = caption.end;
            last.displayText = `${last.displayText}\n${caption.displayText}`;
        } else {
            merged.push({ ...caption });
        }
        return merged;
    }, []);
}

function applyPunctuationPolicy(text, config) {
    return text
        .replace(config.removeComma ? /、/g : /$^/, '')
        .replace(config.removePeriod ? /。/g : /$^/, '')
        .replace(/[「」『』]/g, '')
        .trim();
}

function renderResults(originalSegments, fillerRemoved, captions, config) {
    const removedCount = originalSegments.reduce((count, segment, index) => count + Math.max(0, segment.text.length - fillerRemoved[index].text.length), 0);
    elements.summaryCards.innerHTML = `
        <div><strong>${config.sceneLabel}</strong><span>シーン</span></div>
        <div><strong>${captions.length}</strong><span>字幕ページ</span></div>
        <div><strong>${state.silenceCuts.length}</strong><span>無音カット候補</span></div>
        <div><strong>${removedCount}</strong><span>フィラー削減文字</span></div>
    `;

    const steps = [
        `高精度文字起こし: ${originalSegments.length} セグメントを受け取り`,
        `フィラーカット: ${fillerDictionaries[config.speaker].join(' / ')} を講師辞書で除去`,
        `無音カット: RMS ${config.silenceThreshold} 未満が ${config.silenceDuration} 秒以上の区間を候補化`,
        `テロップ改行: 候補点 + 動的計画法で 1 行 ${config.lineLength} 文字以内に整形`,
        `ページング: 1 ページ最大 2 行、最低 ${config.minPageDuration} 秒を確保`,
        `句読点整形: 表示用テキストからブランドポリシーに沿って削除`,
        '書き出し: SRT / 編集 JSON / ffmpeg コマンドを生成'
    ];
    elements.pipelineList.innerHTML = steps.map(step => `<li>${step}</li>`).join('');
    elements.captionPreview.innerHTML = captions.map(caption => `
        <div class="caption-card">
            <time>${formatTimestamp(caption.start)} → ${formatTimestamp(caption.end)}</time>
            <p>${escapeHtml(caption.displayText).replace(/\n/g, '<br>')}</p>
        </div>
    `).join('');
    elements.ffmpegCommand.textContent = buildFfmpegCommand(config);
    elements.downloadSrtButton.disabled = captions.length === 0;
    elements.downloadJsonButton.disabled = captions.length === 0;
}

function renderEmptyState() {
    elements.summaryCards.innerHTML = `
        <div><strong>0</strong><span>字幕ページ</span></div>
        <div><strong>0</strong><span>無音候補</span></div>
        <div><strong>未処理</strong><span>状態</span></div>
    `;
    elements.pipelineList.innerHTML = '<li>素材と文字起こしを入力してパイプラインを実行してください。</li>';
}

function updatePipelineStatus(message) {
    elements.pipelineList.innerHTML = `<li>${escapeHtml(message)}</li>`;
}

function buildSrt(captions) {
    return captions.map((caption, index) => `${index + 1}\n${formatSrtTime(caption.start)} --> ${formatSrtTime(caption.end)}\n${caption.displayText}\n`).join('\n');
}

function buildEditDecisionList() {
    return {
        source: state.mediaFile ? state.mediaFile.name : null,
        generatedAt: new Date().toISOString(),
        config: getConfig(),
        silenceCuts: state.silenceCuts,
        captions: state.captions
    };
}

function buildFfmpegCommand(config) {
    const inputName = state.mediaFile ? state.mediaFile.name.replace(/\s/g, '\\ ') : 'input.mp4';
    const scale = config.scene === 'shorts' ? 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2' : 'scale=-2:1080';
    return `ffmpeg -i ${inputName} \\
-vf "${scale},subtitles=captions.srt:force_style='FontName=Noto Sans JP Bold,FontSize=42,PrimaryColour=&H00FFFFFF,BackColour=&HA0000000,Bold=1'" \\
-c:v libx264 -preset medium -crf 20 -c:a aac -b:a 192k output_${config.scene}.mp4`;
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${units[index]}`;
}

function formatTimestamp(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${rest}`;
}

function formatSrtTime(seconds) {
    const date = new Date(0);
    date.setSeconds(Math.floor(seconds));
    const milliseconds = Math.round((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${date.toISOString().slice(11, 19)},${milliseconds}`;
}

function roundTime(value) {
    return Math.round(value * 100) / 100;
}

function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#039;',
        '"': '&quot;'
    }[character]));
}
