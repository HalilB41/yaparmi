// ============================================================
// games.js — sadece oyun.html'de çalışır. Basit, tamamen tarayıcı
// içinde (sunucusuz) çalışan 5 küçük oyun: 2048, Yılan, Hafıza,
// XOX (bilgisayara karşı) ve Taş-Kağıt-Makas.
// Her oyun mount(container) fonksiyonuyla açılıyor, {destroy} ile
// kapanıyor (event listener / interval temizliği için).
// ============================================================

(function () {
  "use strict";

  const container = document.getElementById("gameContainer");
  const tabs = document.querySelectorAll(".game-tab");
  if (!container) return;

  const GAMES = {
    "2048": { mount: mount2048 },
    yilan: { mount: mountSnake },
    hafiza: { mount: mountMemory },
    xox: { mount: mountXOX },
    tkm: { mount: mountRPS },
  };

  let activeGame = null;

  function switchGame(key) {
    if (activeGame && typeof activeGame.destroy === "function") {
      try {
        activeGame.destroy();
      } catch (e) {
        console.error(e);
      }
    }
    activeGame = null;
    container.innerHTML = "";
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.game === key));
    const game = GAMES[key];
    if (game) activeGame = game.mount(container) || null;
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchGame(tab.dataset.game));
  });

  // ============================================================
  // 2048
  // ============================================================
  function mount2048(root) {
    root.innerHTML =
      '<div class="g2048-wrap">' +
      '  <div class="g2048-top">' +
      '    <div class="g2048-score">Skor: <span id="g2048Score">0</span></div>' +
      '    <button type="button" class="game-mini-btn" id="g2048New">🔄 Yeni Oyun</button>' +
      "  </div>" +
      '  <div class="g2048-board" id="g2048Board"></div>' +
      '  <p class="muted g2048-hint">Ok tuşları ya da aşağıdaki okları kullan.</p>' +
      '  <div class="dpad" id="g2048Dpad">' +
      '    <button type="button" class="dpad-btn dpad-up" data-dir="up">▲</button>' +
      '    <button type="button" class="dpad-btn dpad-left" data-dir="left">◀</button>' +
      '    <button type="button" class="dpad-btn dpad-right" data-dir="right">▶</button>' +
      '    <button type="button" class="dpad-btn dpad-down" data-dir="down">▼</button>' +
      "  </div>" +
      '  <p class="g2048-over" id="g2048Over" hidden>Oyun bitti! 🙃</p>' +
      "</div>";

    const boardEl = root.querySelector("#g2048Board");
    const scoreEl = root.querySelector("#g2048Score");
    const overEl = root.querySelector("#g2048Over");
    const newBtn = root.querySelector("#g2048New");
    const dpad = root.querySelector("#g2048Dpad");

    let board = [];
    let score = 0;

    function emptyBoard() {
      return [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
    }

    function addRandomTile() {
      const empties = [];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === 0) empties.push([r, c]);
        }
      }
      if (!empties.length) return;
      const [r, c] = empties[Math.floor(Math.random() * empties.length)];
      board[r][c] = Math.random() < 0.9 ? 2 : 4;
    }

    function slideLine(line) {
      const vals = line.filter((v) => v !== 0);
      const merged = [];
      let gain = 0;
      for (let i = 0; i < vals.length; i++) {
        if (i < vals.length - 1 && vals[i] === vals[i + 1]) {
          const v = vals[i] * 2;
          merged.push(v);
          gain += v;
          i++;
        } else {
          merged.push(vals[i]);
        }
      }
      while (merged.length < 4) merged.push(0);
      return { line: merged, gain };
    }

    function arraysEqual(a, b) {
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }

    function move(direction) {
      let moved = false;
      let totalGain = 0;
      const newBoard = board.map((row) => row.slice());

      if (direction === "left" || direction === "right") {
        for (let r = 0; r < 4; r++) {
          let row = newBoard[r].slice();
          if (direction === "right") row.reverse();
          const { line, gain } = slideLine(row);
          const finalLine = direction === "right" ? line.slice().reverse() : line;
          if (!arraysEqual(newBoard[r], finalLine)) moved = true;
          newBoard[r] = finalLine;
          totalGain += gain;
        }
      } else {
        for (let c = 0; c < 4; c++) {
          let col = [newBoard[0][c], newBoard[1][c], newBoard[2][c], newBoard[3][c]];
          if (direction === "down") col.reverse();
          const { line, gain } = slideLine(col);
          const finalLine = direction === "down" ? line.slice().reverse() : line;
          for (let r = 0; r < 4; r++) {
            if (newBoard[r][c] !== finalLine[r]) moved = true;
            newBoard[r][c] = finalLine[r];
          }
          totalGain += gain;
        }
      }

      if (moved) {
        board = newBoard;
        score += totalGain;
        addRandomTile();
        render();
        if (isGameOver()) {
          overEl.hidden = false;
        }
      }
    }

    function isGameOver() {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (board[r][c] === 0) return false;
          if (c < 3 && board[r][c] === board[r][c + 1]) return false;
          if (r < 3 && board[r][c] === board[r + 1][c]) return false;
        }
      }
      return true;
    }

    function render() {
      scoreEl.textContent = String(score);
      boardEl.innerHTML = "";
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const val = board[r][c];
          const tile = document.createElement("div");
          tile.className = "g2048-tile";
          if (val) tile.setAttribute("data-value", String(val));
          tile.textContent = val ? String(val) : "";
          boardEl.appendChild(tile);
        }
      }
    }

    function newGame() {
      board = emptyBoard();
      score = 0;
      overEl.hidden = true;
      addRandomTile();
      addRandomTile();
      render();
    }

    function onKeydown(e) {
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault();
      move(dir);
    }

    function onDpadClick(e) {
      const btn = e.target.closest(".dpad-btn");
      if (!btn) return;
      move(btn.dataset.dir);
    }

    document.addEventListener("keydown", onKeydown);
    dpad.addEventListener("click", onDpadClick);
    newBtn.addEventListener("click", newGame);

    newGame();

    return {
      destroy() {
        document.removeEventListener("keydown", onKeydown);
      },
    };
  }

  // ============================================================
  // Yılan (Snake)
  // ============================================================
  function mountSnake(root) {
    const GRID = 15;
    const CELL = 18;

    root.innerHTML =
      '<div class="snake-wrap">' +
      '  <div class="g2048-top">' +
      '    <div class="g2048-score">Skor: <span id="snakeScore">0</span></div>' +
      '    <button type="button" class="game-mini-btn" id="snakeNew">🔄 Yeni Oyun</button>' +
      "  </div>" +
      '  <canvas id="snakeCanvas" width="' +
      GRID * CELL +
      '" height="' +
      GRID * CELL +
      '"></canvas>' +
      '  <p class="muted g2048-hint">Ok tuşları ya da aşağıdaki okları kullan.</p>' +
      '  <div class="dpad" id="snakeDpad">' +
      '    <button type="button" class="dpad-btn dpad-up" data-dir="up">▲</button>' +
      '    <button type="button" class="dpad-btn dpad-left" data-dir="left">◀</button>' +
      '    <button type="button" class="dpad-btn dpad-right" data-dir="right">▶</button>' +
      '    <button type="button" class="dpad-btn dpad-down" data-dir="down">▼</button>' +
      "  </div>" +
      '  <p class="g2048-over" id="snakeOver" hidden>Yılan öldü! 🐍💀</p>' +
      "</div>";

    const canvas = root.querySelector("#snakeCanvas");
    const ctx = canvas.getContext("2d");
    const scoreEl = root.querySelector("#snakeScore");
    const overEl = root.querySelector("#snakeOver");
    const newBtn = root.querySelector("#snakeNew");
    const dpad = root.querySelector("#snakeDpad");

    let snake, dir, nextDir, food, score, timer, running;

    function place() {
      snake = [
        { x: 7, y: 7 },
        { x: 6, y: 7 },
        { x: 5, y: 7 },
      ];
      dir = "right";
      nextDir = "right";
      score = 0;
      running = true;
      overEl.hidden = true;
      placeFood();
      draw();
    }

    function placeFood() {
      let pos;
      do {
        pos = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
      } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
      food = pos;
    }

    function tick() {
      if (!running) return;
      dir = nextDir;
      const head = { x: snake[0].x, y: snake[0].y };
      if (dir === "up") head.y--;
      else if (dir === "down") head.y++;
      else if (dir === "left") head.x--;
      else head.x++;

      const hitWall = head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID;
      const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);

      if (hitWall || hitSelf) {
        running = false;
        overEl.hidden = false;
        return;
      }

      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score++;
        scoreEl.textContent = String(score);
        placeFood();
      } else {
        snake.pop();
      }
      draw();
    }

    function draw() {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#e0a72e";
      snake.forEach((s, i) => {
        ctx.globalAlpha = i === 0 ? 1 : 0.75;
        ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffd66b";
      ctx.beginPath();
      ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    const opposite = { up: "down", down: "up", left: "right", right: "left" };

    function setDir(d) {
      if (opposite[d] === dir) return;
      nextDir = d;
    }

    function onKeydown(e) {
      const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      setDir(d);
    }

    function onDpadClick(e) {
      const btn = e.target.closest(".dpad-btn");
      if (!btn) return;
      setDir(btn.dataset.dir);
    }

    document.addEventListener("keydown", onKeydown);
    dpad.addEventListener("click", onDpadClick);
    newBtn.addEventListener("click", place);

    place();
    timer = setInterval(tick, 150);

    return {
      destroy() {
        clearInterval(timer);
        document.removeEventListener("keydown", onKeydown);
      },
    };
  }

  // ============================================================
  // Hafıza (Memory Match)
  // ============================================================
  function mountMemory(root) {
    const EMOJIS = ["🎃", "🚀", "🐴", "🔮", "⚽", "📚", "🎮", "🚌"];

    root.innerHTML =
      '<div class="memory-wrap">' +
      '  <div class="g2048-top">' +
      '    <div class="g2048-score">Hamle: <span id="memoryMoves">0</span></div>' +
      '    <button type="button" class="game-mini-btn" id="memoryNew">🔄 Yeni Oyun</button>' +
      "  </div>" +
      '  <div class="memory-grid" id="memoryGrid"></div>' +
      '  <p class="g2048-over" id="memoryWin" hidden>Tebrikler, hepsini buldun! 🎉</p>' +
      "</div>";

    const grid = root.querySelector("#memoryGrid");
    const movesEl = root.querySelector("#memoryMoves");
    const winEl = root.querySelector("#memoryWin");
    const newBtn = root.querySelector("#memoryNew");

    let cards, flipped, lock, matched, moves;

    function shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    function build() {
      const pairs = shuffle(EMOJIS.concat(EMOJIS));
      flipped = [];
      lock = false;
      matched = 0;
      moves = 0;
      movesEl.textContent = "0";
      winEl.hidden = true;
      grid.innerHTML = "";
      cards = pairs.map((emoji, i) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "memory-card";
        card.dataset.index = String(i);
        card.innerHTML = '<span class="memory-face memory-back">❓</span><span class="memory-face memory-front">' + emoji + "</span>";
        card.addEventListener("click", () => onCardClick(i, emoji, card));
        grid.appendChild(card);
        return card;
      });
    }

    function onCardClick(i, emoji, card) {
      if (lock) return;
      if (card.classList.contains("is-flipped") || card.classList.contains("is-matched")) return;

      card.classList.add("is-flipped");
      flipped.push({ i, emoji, card });

      if (flipped.length === 2) {
        moves++;
        movesEl.textContent = String(moves);
        const [a, b] = flipped;
        if (a.emoji === b.emoji) {
          a.card.classList.add("is-matched");
          b.card.classList.add("is-matched");
          flipped = [];
          matched++;
          if (matched === EMOJIS.length) {
            winEl.hidden = false;
          }
        } else {
          lock = true;
          setTimeout(() => {
            a.card.classList.remove("is-flipped");
            b.card.classList.remove("is-flipped");
            flipped = [];
            lock = false;
          }, 800);
        }
      }
    }

    newBtn.addEventListener("click", build);
    build();

    return { destroy() {} };
  }

  // ============================================================
  // XOX (Tic-Tac-Toe) — bilgisayara karşı, minimax ile (kaybetmez)
  // ============================================================
  function mountXOX(root) {
    root.innerHTML =
      '<div class="xox-wrap">' +
      '  <div class="g2048-top">' +
      '    <div class="g2048-score" id="xoxStatus">Sıra sende (❌)</div>' +
      '    <button type="button" class="game-mini-btn" id="xoxNew">🔄 Yeni Oyun</button>' +
      "  </div>" +
      '  <div class="xox-grid" id="xoxGrid"></div>' +
      "</div>";

    const gridEl = root.querySelector("#xoxGrid");
    const statusEl = root.querySelector("#xoxStatus");
    const newBtn = root.querySelector("#xoxNew");

    const HUMAN = "❌";
    const AI = "⭕";
    let board, over;

    const LINES = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    function winner(b) {
      for (const [a, c, d] of LINES) {
        if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
      }
      if (b.every((v) => v)) return "draw";
      return null;
    }

    function minimax(b, player) {
      const w = winner(b);
      if (w === AI) return { score: 10 };
      if (w === HUMAN) return { score: -10 };
      if (w === "draw") return { score: 0 };

      const moves = [];
      for (let i = 0; i < 9; i++) {
        if (b[i]) continue;
        const nb = b.slice();
        nb[i] = player;
        const result = minimax(nb, player === AI ? HUMAN : AI);
        moves.push({ index: i, score: result.score });
      }

      if (player === AI) {
        return moves.reduce((best, m) => (m.score > best.score ? m : best), { score: -Infinity });
      }
      return moves.reduce((best, m) => (m.score < best.score ? m : best), { score: Infinity });
    }

    function aiMove() {
      const best = minimax(board, AI);
      if (typeof best.index === "number") {
        board[best.index] = AI;
      }
    }

    function render() {
      gridEl.innerHTML = "";
      board.forEach((val, i) => {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "xox-cell";
        cell.textContent = val || "";
        if (!val && !over) {
          cell.addEventListener("click", () => onCellClick(i));
        }
        gridEl.appendChild(cell);
      });
    }

    function onCellClick(i) {
      if (over || board[i]) return;
      board[i] = HUMAN;
      let w = winner(board);
      if (!w) {
        aiMove();
        w = winner(board);
      }
      render();
      if (w) {
        over = true;
        if (w === "draw") statusEl.textContent = "Berabere! 🤝";
        else if (w === HUMAN) statusEl.textContent = "Kazandın! 🎉";
        else statusEl.textContent = "Bilgisayar kazandı! 🤖";
      } else {
        statusEl.textContent = "Sıra sende (❌)";
      }
    }

    function newGame() {
      board = Array(9).fill(null);
      over = false;
      statusEl.textContent = "Sıra sende (❌)";
      render();
    }

    newBtn.addEventListener("click", newGame);
    newGame();

    return { destroy() {} };
  }

  // ============================================================
  // Taş - Kağıt - Makas
  // ============================================================
  function mountRPS(root) {
    const CHOICES = [
      { key: "tas", label: "🪨 Taş" },
      { key: "kagit", label: "📄 Kağıt" },
      { key: "makas", label: "✂️ Makas" },
    ];
    const BEATS = { tas: "makas", kagit: "tas", makas: "kagit" };

    root.innerHTML =
      '<div class="rps-wrap">' +
      '  <div class="rps-score" id="rpsScore">Sen: 0 · Bilgisayar: 0 · Berabere: 0</div>' +
      '  <div class="rps-choices" id="rpsChoices"></div>' +
      '  <p class="rps-result" id="rpsResult">Bir seçim yap!</p>' +
      "</div>";

    const scoreEl = root.querySelector("#rpsScore");
    const resultEl = root.querySelector("#rpsResult");
    const choicesEl = root.querySelector("#rpsChoices");

    let you = 0;
    let comp = 0;
    let draw = 0;

    CHOICES.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "rps-choice-btn";
      btn.textContent = c.label;
      btn.addEventListener("click", () => play(c.key));
      choicesEl.appendChild(btn);
    });

    function play(choice) {
      const compChoice = CHOICES[Math.floor(Math.random() * CHOICES.length)].key;
      let text;
      if (choice === compChoice) {
        draw++;
        text = "Berabere! İkiniz de " + labelFor(choice);
      } else if (BEATS[choice] === compChoice) {
        you++;
        text = "Kazandın! " + labelFor(choice) + " → " + labelFor(compChoice);
      } else {
        comp++;
        text = "Kaybettin! " + labelFor(compChoice) + " → " + labelFor(choice);
      }
      resultEl.textContent = text;
      scoreEl.textContent = "Sen: " + you + " · Bilgisayar: " + comp + " · Berabere: " + draw;
    }

    function labelFor(key) {
      const found = CHOICES.find((c) => c.key === key);
      return found ? found.label : key;
    }

    return { destroy() {} };
  }

  // Başlangıçta ilk sekmeyi aç
  const firstTab = tabs[0];
  switchGame(firstTab ? firstTab.dataset.game : "2048");
})();
