// Configuración del juego basada en los datos JSON
const GAME_CONFIG = {
    gridWidth: 10,
    gridHeight: 20,
    blockSize: 30,
    fallSpeed: 1000,
    speedIncrement: 50,
    linesPerLevel: 10,
    autosaveInterval: 3
};

const COLORS = {
    primary: '#A2B5C3',
    secondary: '#5D5337',
    accent: '#193A3E',
    background: '#DEE1DD',
    neutral: '#ADA799',
    teal: '#4D757B'
};

const TETROMINOES = {
    I: { color: '#A2B5C3', shape: [[1, 1, 1, 1]] },
    O: { color: '#5D5337', shape: [[1, 1], [1, 1]] },
    T: { color: '#193A3E', shape: [[0, 1, 0], [1, 1, 1]] },
    S: { color: '#4D757B', shape: [[0, 1, 1], [1, 1, 0]] },
    Z: { color: '#ADA799', shape: [[1, 1, 0], [0, 1, 1]] },
    J: { color: '#7A8B99', shape: [[1, 0, 0], [1, 1, 1]] },
    L: { color: '#8C9A7E', shape: [[0, 0, 1], [1, 1, 1]] }
};

const TETROMINO_TYPES = Object.keys(TETROMINOES);

// Variables globales del juego
let gameState = {
    grid: [],
    currentPiece: null,
    nextPiece: null,
    score: 0,
    lines: 0,
    level: 1,
    gameOver: false,
    paused: false,
    fallTime: 0,
    fallSpeed: GAME_CONFIG.fallSpeed,
    linesThisLevel: 0
};

let gameCanvas, gameCtx, nextPieceCanvas, nextPieceCtx;
let audioContext, audioEnabled = true, masterVolume = 0.5;
let gameLoop, lastTime = 0;
let keys = {};

// Variables para controles táctiles
let touchStartX = null;
let touchStartY = null;
let touchStartTime = null;
let lastTouchTime = 0;
let touchCount = 0;
let isMobile = false;

// Detección de dispositivo móvil
function detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()) || 
           ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0);
}

// Inicialización del juego
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing game...');
    isMobile = detectMobile();
    
    if (isMobile) {
        document.body.classList.add('mobile-device');
        
        // Prevenir scroll y zoom de manera más agresiva
        document.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        // Prevenir zoom con doble toque en todo el documento
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Prevenir el comportamiento de pull-to-refresh
        document.addEventListener('touchstart', (e) => {
            if (e.touches[0].clientY < 50) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Ajustar el tamaño del canvas según el dispositivo
        adjustCanvasSize();
        window.addEventListener('resize', adjustCanvasSize);
        window.addEventListener('orientationchange', () => {
            setTimeout(adjustCanvasSize, 100);
        });
    }
    
    initializeGame();
    setupEventListeners();
    checkForSavedGame();
});

function adjustCanvasSize() {
    if (!isMobile) return;
    
    const gameScreen = document.getElementById('gameScreen');
    const gameArea = document.querySelector('.game-area');
    
    if (gameScreen && gameScreen.classList.contains('active')) {
        // Usar las dimensiones reales del viewport
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        
        // Calcular el espacio usado por la UI
        const gameInfo = document.querySelector('.game-info');
        const gameControls = document.querySelector('.game-controls');
        const infoHeight = gameInfo ? gameInfo.offsetHeight : 60;
        const controlsHeight = gameControls ? gameControls.offsetHeight : 50;
        
        // Espacio disponible para el canvas con pequeño margen
        const availableHeight = viewportHeight - infoHeight - controlsHeight - 20;
        const availableWidth = viewportWidth - 20;
        
        // Calcular el tamaño óptimo del canvas
        const cellSizeByHeight = Math.floor(availableHeight / GAME_CONFIG.gridHeight);
        const cellSizeByWidth = Math.floor(availableWidth / GAME_CONFIG.gridWidth);
        const cellSize = Math.min(cellSizeByHeight, cellSizeByWidth);
        
        GAME_CONFIG.blockSize = cellSize;
        
        if (gameCanvas) {
            gameCanvas.width = GAME_CONFIG.gridWidth * cellSize;
            gameCanvas.height = GAME_CONFIG.gridHeight * cellSize;
        }
        
        if (nextPieceCanvas) {
            nextPieceCanvas.width = 60;
            nextPieceCanvas.height = 60;
        }
    }
}

function initializeGame() {
    gameCanvas = document.getElementById('gameCanvas');
    gameCtx = gameCanvas.getContext('2d');
    nextPieceCanvas = document.getElementById('nextPieceCanvas');
    nextPieceCtx = nextPieceCanvas.getContext('2d');
    
    // Inicializar Web Audio API
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        setupAudio();
    } catch (e) {
        console.warn('Audio no disponible:', e);
        audioEnabled = false;
    }
    
    // Inicializar grid
    gameState.grid = Array(GAME_CONFIG.gridHeight).fill().map(() => 
        Array(GAME_CONFIG.gridWidth).fill(0)
    );
    
    showScreen('mainScreen');
}

function setupEventListeners() {
    // Botones del menú con múltiples métodos de evento
    const playButton = document.getElementById('playButton');
    const continueButton = document.getElementById('continueButton');
    const pauseButton = document.getElementById('pauseButton');
    const resumeButton = document.getElementById('resumeButton');
    const newGameButton = document.getElementById('newGameButton');
    const playAgainButton = document.getElementById('playAgainButton');
    const mainMenuButton = document.getElementById('mainMenuButton');
    
    // Asegurar que los botones respondan a clics
    if (playButton) {
        playButton.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Play button clicked');
            startNewGame();
        });
        playButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startNewGame();
        });
    }
    
    if (continueButton) {
        continueButton.addEventListener('click', (e) => {
            e.preventDefault();
            continueGame();
        });
        continueButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            continueGame();
        });
    }
    
    if (pauseButton) {
        pauseButton.addEventListener('click', (e) => {
            e.preventDefault();
            togglePause();
        });
    }
    
    if (resumeButton) {
        resumeButton.addEventListener('click', (e) => {
            e.preventDefault();
            togglePause();
        });
    }
    
    if (newGameButton) {
        newGameButton.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('mainScreen');
            resetGame();
        });
    }
    
    if (playAgainButton) {
        playAgainButton.addEventListener('click', (e) => {
            e.preventDefault();
            startNewGame();
        });
    }
    
    if (mainMenuButton) {
        mainMenuButton.addEventListener('click', (e) => {
            e.preventDefault();
            showScreen('mainScreen');
            resetGame();
        });
    }
    
    // Control de volumen
    const volumeSlider = document.getElementById('volumeSlider');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            masterVolume = e.target.value / 100;
        });
    }
    
    // Controles del teclado (solo si no es móvil)
    if (!isMobile) {
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
    }
    
    // Controles táctiles (solo si es móvil)
    if (isMobile && gameCanvas) {
        setupTouchControls();
    }
    
    // Pausar automáticamente cuando se pierde el foco
    window.addEventListener('blur', () => {
        if (!gameState.gameOver && !gameState.paused && !isMobile) {
            togglePause();
        }
    });
    
    console.log('Event listeners set up');
}

function setupTouchControls() {
    const touchArea = gameCanvas;
    
    touchArea.addEventListener('touchstart', handleTouchStart, { passive: false });
    touchArea.addEventListener('touchmove', handleTouchMove, { passive: false });
    touchArea.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function handleTouchStart(e) {
    e.preventDefault();
    
    if (gameState.gameOver || gameState.paused) return;
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    
    // Detectar doble toque para bajada rápida
    const currentTime = Date.now();
    if (currentTime - lastTouchTime < 300) {
        touchCount++;
    } else {
        touchCount = 1;
    }
    lastTouchTime = currentTime;
}

function handleTouchMove(e) {
    e.preventDefault();
    
    if (gameState.gameOver || gameState.paused || !touchStartX || !touchStartY) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;
    
    // Umbral mínimo para detectar movimiento
    const threshold = 30;
    const timeThreshold = 300; // ms
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Movimiento horizontal
        if (Math.abs(deltaX) > threshold) {
            if (deltaX > 0) {
                movePiece(1, 0);
                playSound('move');
            } else {
                movePiece(-1, 0);
                playSound('move');
            }
            // Reset para evitar movimientos múltiples
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
        }
    } else {
        // Movimiento vertical
        if (deltaY < -threshold && deltaTime < timeThreshold) {
            // Deslizar hacia arriba - rotar
            rotatePiece();
            playSound('rotate');
            touchStartX = null;
            touchStartY = null;
        } else if (deltaY > threshold) {
            // Deslizar hacia abajo - bajar
            movePiece(0, 1);
            touchStartY = touch.clientY;
        }
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    
    if (gameState.gameOver || gameState.paused) return;
    
    const deltaTime = Date.now() - touchStartTime;
    
    // Detectar doble toque para bajada rápida
    if (deltaTime < 200 && touchStartX !== null && touchStartY !== null) {
        const currentTime = Date.now();
        if (currentTime - lastTouchTime < 300 && touchCount === 2) {
            hardDrop();
            playSound('drop');
            touchCount = 0;
        }
    }
    
    touchStartX = null;
    touchStartY = null;
}

function handleKeyDown(e) {
    if (gameState.gameOver || gameState.paused) return;
    
    keys[e.code] = true;
    
    switch (e.code) {
        case 'ArrowLeft':
            e.preventDefault();
            movePiece(-1, 0);
            playSound('move');
            break;
        case 'ArrowRight':
            e.preventDefault();
            movePiece(1, 0);
            playSound('move');
            break;
        case 'ArrowDown':
            e.preventDefault();
            movePiece(0, 1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            rotatePiece();
            playSound('rotate');
            break;
        case 'Space':
            e.preventDefault();
            hardDrop();
            playSound('drop');
            break;
        case 'KeyP':
            e.preventDefault();
            togglePause();
            break;
    }
}

function handleKeyUp(e) {
    keys[e.code] = false;
}

// Funciones de audio
function setupAudio() {
    if (!audioContext) return;
    
    // Crear nodos de audio para música ambiente
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Música ambiente sutil
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(110, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.02, audioContext.currentTime);
    
    try {
        oscillator.start();
    } catch (e) {
        console.warn('No se pudo iniciar el audio:', e);
    }
}

function playSound(type) {
    if (!audioContext || !audioEnabled) return;
    
    const frequencies = {
        move: 220,
        rotate: 330,
        drop: 110,
        lineClear: 440,
        levelUp: 880
    };
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(masterVolume * 0.1, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

// Funciones de navegación
function showScreen(screenId) {
    console.log('Switching to screen:', screenId);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        
        // Ajustar tamaño del canvas cuando se muestra la pantalla de juego
        if (screenId === 'gameScreen' && isMobile) {
            setTimeout(adjustCanvasSize, 100);
        }
    }
}

function checkForSavedGame() {
    const savedGame = localStorage.getItem('eugeGameState');
    if (savedGame) {
        const continueButton = document.getElementById('continueButton');
        if (continueButton) {
            continueButton.classList.remove('hidden');
        }
    }
}

// Funciones del juego
function startNewGame() {
    console.log('Starting new game...');
    resetGame();
    showScreen('gameScreen');
    if (isMobile) {
        // Dar tiempo para que el DOM se actualice antes de ajustar el canvas
        setTimeout(() => {
            adjustCanvasSize();
        }, 50);
    }
    gameState.currentPiece = createPiece();
    gameState.nextPiece = createPiece();
    updateUI();
    startGameLoop();
}

function continueGame() {
    const savedGame = localStorage.getItem('eugeGameState');
    if (savedGame) {
        gameState = JSON.parse(savedGame);
        showScreen('gameScreen');
        if (isMobile) {
            setTimeout(() => {
                adjustCanvasSize();
            }, 50);
        }
        updateUI();
        startGameLoop();
    }
}

function resetGame() {
    gameState = {
        grid: Array(GAME_CONFIG.gridHeight).fill().map(() => 
            Array(GAME_CONFIG.gridWidth).fill(0)
        ),
        currentPiece: null,
        nextPiece: null,
        score: 0,
        lines: 0,
        level: 1,
        gameOver: false,
        paused: false,
        fallTime: 0,
        fallSpeed: GAME_CONFIG.fallSpeed,
        linesThisLevel: 0
    };
    
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    
    // Ocultar overlays
    document.getElementById('pauseOverlay').classList.add('hidden');
    document.getElementById('gameOverOverlay').classList.add('hidden');
    
    updateUI();
}

function createPiece() {
    const type = TETROMINO_TYPES[Math.floor(Math.random() * TETROMINO_TYPES.length)];
    const tetromino = TETROMINOES[type];
    
    return {
        type: type,
        shape: tetromino.shape.map(row => [...row]),
        color: tetromino.color,
        x: Math.floor(GAME_CONFIG.gridWidth / 2) - Math.floor(tetromino.shape[0].length / 2),
        y: 0
    };
}

function movePiece(dx, dy) {
    if (!gameState.currentPiece) return false;
    
    const newX = gameState.currentPiece.x + dx;
    const newY = gameState.currentPiece.y + dy;
    
    if (isValidMove(gameState.currentPiece.shape, newX, newY)) {
        gameState.currentPiece.x = newX;
        gameState.currentPiece.y = newY;
        return true;
    }
    
    return false;
}

function rotatePiece() {
    if (!gameState.currentPiece) return;
    
    const rotatedShape = rotateMatrix(gameState.currentPiece.shape);
    
    if (isValidMove(rotatedShape, gameState.currentPiece.x, gameState.currentPiece.y)) {
        gameState.currentPiece.shape = rotatedShape;
    }
}

function rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
    
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            rotated[j][rows - 1 - i] = matrix[i][j];
        }
    }
    
    return rotated;
}

function isValidMove(shape, x, y) {
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                const newX = x + j;
                const newY = y + i;
                
                if (newX < 0 || newX >= GAME_CONFIG.gridWidth || 
                    newY >= GAME_CONFIG.gridHeight || 
                    (newY >= 0 && gameState.grid[newY][newX])) {
                    return false;
                }
            }
        }
    }
    return true;
}

function hardDrop() {
    if (!gameState.currentPiece) return;
    
    while (movePiece(0, 1)) {
        // Continuar bajando hasta que no sea posible
    }
    
    placePiece();
}

function placePiece() {
    if (!gameState.currentPiece) return;
    
    const { shape, color, x, y } = gameState.currentPiece;
    
    // Colocar la pieza en el grid
    for (let i = 0; i < shape.length; i++) {
        for (let j = 0; j < shape[i].length; j++) {
            if (shape[i][j]) {
                const gridY = y + i;
                const gridX = x + j;
                
                if (gridY >= 0) {
                    gameState.grid[gridY][gridX] = color;
                }
            }
        }
    }
    
    // Verificar líneas completadas
    const linesCleared = clearLines();
    if (linesCleared > 0) {
        updateScore(linesCleared);
        playSound('lineClear');
        createLineParticles();
    }
    
    // Crear siguiente pieza
    gameState.currentPiece = gameState.nextPiece;
    gameState.nextPiece = createPiece();
    
    // Verificar game over
    if (!isValidMove(gameState.currentPiece.shape, gameState.currentPiece.x, gameState.currentPiece.y)) {
        gameOver();
    }
    
    // Guardar automáticamente
    if (gameState.lines % GAME_CONFIG.autosaveInterval === 0) {
        saveGame();
    }
}

function clearLines() {
    let linesCleared = 0;
    
    for (let y = GAME_CONFIG.gridHeight - 1; y >= 0; y--) {
        if (gameState.grid[y].every(cell => cell !== 0)) {
            gameState.grid.splice(y, 1);
            gameState.grid.unshift(Array(GAME_CONFIG.gridWidth).fill(0));
            linesCleared++;
            y++; // Revisar la misma línea otra vez
        }
    }
    
    return linesCleared;
}

function updateScore(linesCleared) {
    const lineScores = [0, 40, 100, 300, 1200];
    gameState.score += lineScores[linesCleared] * gameState.level;
    gameState.lines += linesCleared;
    gameState.linesThisLevel += linesCleared;
    
    // Subir nivel
    if (gameState.linesThisLevel >= GAME_CONFIG.linesPerLevel) {
        gameState.level++;
        gameState.linesThisLevel = 0;
        gameState.fallSpeed = Math.max(50, gameState.fallSpeed - GAME_CONFIG.speedIncrement);
        playSound('levelUp');
    }
    
    updateUI();
}

function createLineParticles() {
    const gameArea = document.querySelector('.game-area');
    
    for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * gameCanvas.width + 'px';
        particle.style.top = Math.random() * gameCanvas.height + 'px';
        gameArea.appendChild(particle);
        
        setTimeout(() => {
            particle.remove();
        }, 2000);
    }
}

function gameOver() {
    gameState.gameOver = true;
    
    if (gameLoop) {
        cancelAnimationFrame(gameLoop);
    }
    
    document.getElementById('finalScore').textContent = gameState.score;
    document.getElementById('gameOverOverlay').classList.remove('hidden');
    
    // Limpiar guardado
    localStorage.removeItem('eugeGameState');
}

function togglePause() {
    gameState.paused = !gameState.paused;
    
    if (gameState.paused) {
        document.getElementById('pauseOverlay').classList.remove('hidden');
        if (gameLoop) {
            cancelAnimationFrame(gameLoop);
        }
    } else {
        document.getElementById('pauseOverlay').classList.add('hidden');
        startGameLoop();
    }
}

function saveGame() {
    localStorage.setItem('eugeGameState', JSON.stringify(gameState));
}

function updateUI() {
    document.getElementById('score').textContent = gameState.score;
    document.getElementById('lines').textContent = gameState.lines;
    document.getElementById('level').textContent = gameState.level;
}

// Funciones de renderizado
function startGameLoop() {
    lastTime = 0;
    gameLoop = requestAnimationFrame(update);
}

function update(time) {
    if (gameState.gameOver || gameState.paused) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;
    
    gameState.fallTime += deltaTime;
    
    if (gameState.fallTime >= gameState.fallSpeed) {
        if (!movePiece(0, 1)) {
            placePiece();
        }
        gameState.fallTime = 0;
    }
    
    render();
    gameLoop = requestAnimationFrame(update);
}

function render() {
    const blockSize = GAME_CONFIG.blockSize;
    
    // Limpiar canvas
    gameCtx.fillStyle = '#FFFFFF';
    gameCtx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);
    
    // Renderizar grid
    renderGrid();
    
    // Renderizar pieza actual
    if (gameState.currentPiece) {
        renderPiece(gameState.currentPiece, gameCtx);
    }
    
    // Renderizar siguiente pieza
    renderNextPiece();
}

function renderGrid() {
    const blockSize = GAME_CONFIG.blockSize;
    
    for (let y = 0; y < GAME_CONFIG.gridHeight; y++) {
        for (let x = 0; x < GAME_CONFIG.gridWidth; x++) {
            if (gameState.grid[y][x]) {
                gameCtx.fillStyle = gameState.grid[y][x];
                gameCtx.fillRect(
                    x * blockSize,
                    y * blockSize,
                    blockSize - 1,
                    blockSize - 1
                );
            }
        }
    }
}

function renderPiece(piece, ctx) {
    const blockSize = GAME_CONFIG.blockSize;
    ctx.fillStyle = piece.color;
    
    for (let i = 0; i < piece.shape.length; i++) {
        for (let j = 0; j < piece.shape[i].length; j++) {
            if (piece.shape[i][j]) {
                const x = (piece.x + j) * blockSize;
                const y = (piece.y + i) * blockSize;
                
                ctx.fillRect(x, y, blockSize - 1, blockSize - 1);
            }
        }
    }
}

function renderNextPiece() {
    nextPieceCtx.fillStyle = '#FFFFFF';
    nextPieceCtx.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
    
    if (gameState.nextPiece) {
        const piece = gameState.nextPiece;
        const blockSize = isMobile ? 12 : 20;
        const offsetX = (nextPieceCanvas.width - piece.shape[0].length * blockSize) / 2;
        const offsetY = (nextPieceCanvas.height - piece.shape.length * blockSize) / 2;
        
        nextPieceCtx.fillStyle = piece.color;
        
        for (let i = 0; i < piece.shape.length; i++) {
            for (let j = 0; j < piece.shape[i].length; j++) {
                if (piece.shape[i][j]) {
                    nextPieceCtx.fillRect(
                        offsetX + j * blockSize,
                        offsetY + i * blockSize,
                        blockSize - 1,
                        blockSize - 1
                    );
                }
            }
        }
    }
}
