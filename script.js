// DOMが完全に読み込まれたら実行
document.addEventListener('DOMContentLoaded', () => {
    // HTML要素の取得
    const board = document.getElementById('game-board'); // ゲーム盤
    const mineCountDiv = document.getElementById('mine-count'); // 地雷数の表示
    const timerDiv = document.getElementById('timer'); // タイマーの表示
    const resetButton = document.getElementById('reset-button'); // リセットボタン

    const beginnerButton = document.getElementById('beginner-button');
    const intermediateButton = document.getElementById('intermediate-button');
    const expertButton = document.getElementById('expert-button');

    // ゲームの設定
    const difficulties = {
        beginner: { ROWS: 9, COLS: 9, MINES: 10 },
        intermediate: { ROWS: 16, COLS: 16, MINES: 40 },
        expert: { ROWS: 16, COLS: 30, MINES: 99 }
    };
    let currentDifficulty = difficulties.beginner;
    let ROWS = currentDifficulty.ROWS;
    let COLS = currentDifficulty.COLS;
    let MINES = currentDifficulty.MINES;

    // ゲームの状態を管理する変数
    let mineLocations = []; // 地雷の位置を格納する配列
    let revealedCount = 0; // 開かれたセルの数
    let flags = 0; // 立てられた旗の数
    let timerInstance; // anime.jsのタイマーインスタンス
    let timerStarted = false;
    let gameInProgress = false;

    /**
     * 数字を4桁の文字列にフォーマットする関数 (例: 123 -> "0123")
     * @param {number} num - フォーマットする数字
     * @returns {string} - 4桁にフォーマットされた文字列
     */
    function formatDisplay(num, length = 3) {
        return String(num).padStart(length, '0');
    }

    /**
     * タイマーの時間をSSSS.ms形式でフォーマットする関数
     * @param {number} ms - ミリ秒単位の時間
     * @returns {string} - フォーマットされた時間文字列
     */
    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const displayMs = Math.floor((ms % 1000) / 100); // 1ミリ秒単位で表示 (下1桁)

        const seconds = String(totalSeconds).padStart(4, '0');
        const milliseconds = String(displayMs).padStart(1, '0');

        return `${seconds}.${milliseconds}`;
    }

    /**
     * ゲームを初期化する関数
     */
    function init() {
        // 既存のタイマーを停止
        if (timerInstance) timerInstance.pause();

        // ゲーム盤と状態をリセット
        board.innerHTML = '';
        mineLocations = [];
        revealedCount = 0;
        flags = 0;
        gameInProgress = true;
        timerStarted = false;

        // 表示をリセット
        mineCountDiv.textContent = formatDisplay(MINES);
        timerDiv.textContent = formatTime(0);
        resetButton.className = 'happy';

        // 難易度に応じてグリッドテンプレートを更新
        board.style.gridTemplateColumns = `repeat(${COLS}, 20px)`;
        board.style.gridTemplateRows = `repeat(${ROWS}, 20px)`;
        board.style.setProperty('--cols', COLS);
        board.style.setProperty('--rows', ROWS);
        board.style.width = `${COLS * 20}px`;
        board.style.height = `${ROWS * 20}px`;

        // ゲーム盤のセルを生成
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.addEventListener('click', handleClick);
                cell.addEventListener('contextmenu', handleRightClick);
                cell.addEventListener('mousedown', handleChordClick);
                board.appendChild(cell);
            }
        }
    }

    /**
     * タイマーを開始する関数
     */
    function startTimer() {
        if (timerStarted) return;
        timerStarted = true;
        let startTime = Date.now();
        
        // anime.jsのTimerを使用
        const timer = anime.timeline({
            duration: Infinity,
            autoplay: true,
            update: function() {
                const elapsedTime = Date.now() - startTime;
                timerDiv.textContent = formatTime(elapsedTime);
            }
        });
        
        timerInstance = timer;
    }

    /**
     * 地雷を配置する関数
     * @param {number} startRow - 最初のクリックの行
     * @param {number} startCol - 最初のクリックの列
     */
    function placeMines(startRow, startCol) {
        const safePositions = new Set();
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                safePositions.add(`${startRow + i}-${startCol + j}`);
            }
        }

        let minesPlaced = 0;
        while (minesPlaced < MINES) {
            const row = Math.floor(Math.random() * ROWS);
            const col = Math.floor(Math.random() * COLS);
            const pos = `${row}-${col}`;

            if (!mineLocations.includes(pos) && !safePositions.has(pos)) {
                mineLocations.push(pos);
                minesPlaced++;
            }
        }
    }

    /**
     * セルが左クリックされたときの処理
     */
    function handleClick(event) {
        if (!gameInProgress) return;
        const cell = event.target;
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        if (cell.classList.contains('opened') || cell.classList.contains('flagged')) {
            return;
        }

        if (!timerStarted) {
            placeMines(row, col); // 最初のクリックで地雷を配置
            startTimer(); // タイマーを開始
        }

        if (mineLocations.includes(`${row}-${col}`)) {
            gameOver(false);
        } else {
            revealCell(row, col);
        }
    }

    /**
     * セルが右クリックされたときの処理
     */
    function handleRightClick(event) {
        event.preventDefault();
        if (!gameInProgress) return;
        const cell = event.target;
        if (cell.classList.contains('opened')) return;

        cell.classList.toggle('flagged');
        if (cell.classList.contains('flagged')) {
            flags++;
        } else {
            flags--;
        }
        mineCountDiv.textContent = formatDisplay(MINES - flags);
    }

    /**
     * 左右同時クリックの処理
     */
    function handleChordClick(event) {
        if (!gameInProgress || event.buttons !== 3) return;
        const cell = event.target;
        if (!cell.classList.contains('opened')) return;

        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        // まず、周囲に間違った旗がないかチェックし、あれば即座にゲームオーバー
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const newRow = row + i;
                const newCol = col + j;
                if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                    const adjacentCell = document.querySelector(`[data-row='${newRow}'][data-col='${newCol}']`);
                    if (adjacentCell.classList.contains('flagged') && !mineLocations.includes(`${newRow}-${newCol}`)) {
                        gameOver(false);
                        return; // 間違った旗があれば即座に処理を終了
                    }
                }
            }
        }

        // 間違った旗がなければ、通常の同時押し処理
        adjacentMines = countAdjacentMines(row, col);
        adjacentFlags = countAdjacentFlags(row, col);

        if (adjacentMines === adjacentFlags) {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (i === 0 && j === 0) continue;
                    const newRow = row + i;
                    const newCol = col + j;
                    if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                        const adjacentCell = document.querySelector(`[data-row='${newRow}'][data-col='${newCol}']`);
                        if (!adjacentCell.classList.contains('flagged')) {
                            revealCell(newRow, newCol);
                        }
                    }
                }
            }
        }
    }

    /**
     * セルを開く処理
     */
    function revealCell(row, col) {
        const cell = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
        if (!cell || cell.classList.contains('opened') || !gameInProgress) return;

        cell.classList.add('opened');
        revealedCount++;

        const adjacentMines = countAdjacentMines(row, col);
        if (adjacentMines > 0) {
            cell.textContent = adjacentMines;
            cell.setAttribute('data-adjacent', adjacentMines);
        } else {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    if (i === 0 && j === 0) continue;
                    revealCell(row + i, col + j);
                }
            }
        }

        if (revealedCount === ROWS * COLS - MINES) {
            gameOver(true);
        }
    }

    /**
     * ゲーム終了時の処理
     * @param {boolean} isWin - 勝利したかどうか
     */
    function gameOver(isWin) {
        gameInProgress = false;
        if (timerInstance) timerInstance.pause();
        resetButton.className = isWin ? 'cool' : 'sad';

        if (isWin) {
            setTimeout(() => alert('クリア！おめでとう！'), 100);
        } else {
            revealMines();
            setTimeout(() => alert('ゲームオーバー！'), 100);
        }
    }

    /**
     * 周囲の地雷を数える
     */
    function countAdjacentMines(row, col) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const newRow = row + i;
                const newCol = col + j;
                if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                    if (mineLocations.includes(`${newRow}-${newCol}`)) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    /**
     * 周囲の旗を数える
     */
    function countAdjacentFlags(row, col) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                const newRow = row + i;
                const newCol = col + j;
                if (newRow >= 0 && newRow < ROWS && newCol >= 0 && newCol < COLS) {
                    const cell = document.querySelector(`[data-row='${newRow}'][data-col='${newCol}']`);
                    if (cell.classList.contains('flagged')) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    /**
     * すべての地雷を表示する
     */
    function revealMines() {
        mineLocations.forEach(pos => {
            const [row, col] = pos.split('-');
            const cell = document.querySelector(`[data-row='${row}'][data-col='${col}']`);
            cell.classList.add('mine');
        });
    }

    // リセットボタンにクリックイベントを追加
    resetButton.addEventListener('click', init);

    // 難易度選択ボタンにイベントリスナーを追加
    beginnerButton.addEventListener('click', () => setDifficulty('beginner'));
    intermediateButton.addEventListener('click', () => setDifficulty('intermediate'));
    expertButton.addEventListener('click', () => setDifficulty('expert'));

    /**
     * 難易度を設定し、ゲームを初期化する関数
     * @param {string} level - 難易度レベル (beginner, intermediate, expert)
     */
    function setDifficulty(level) {
        currentDifficulty = difficulties[level];
        ROWS = currentDifficulty.ROWS;
        COLS = currentDifficulty.COLS;
        MINES = currentDifficulty.MINES;
        init();
        updateDifficultyButtons(level);
    }

    /**
     * 難易度ボタンのアクティブ状態を更新する関数
     * @param {string} activeLevel - 現在アクティブな難易度レベル
     */
    function updateDifficultyButtons(activeLevel) {
        beginnerButton.classList.remove('active');
        intermediateButton.classList.remove('active');
        expertButton.classList.remove('active');

        if (activeLevel === 'beginner') {
            beginnerButton.classList.add('active');
        } else if (activeLevel === 'intermediate') {
            intermediateButton.classList.add('active');
        } else if (activeLevel === 'expert') {
            expertButton.classList.add('active');
        }
    }

    // ゲームを開始
    init();
    updateDifficultyButtons('beginner'); // 初期表示で初級をアクティブにする
});
