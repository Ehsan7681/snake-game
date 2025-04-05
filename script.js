document.addEventListener('DOMContentLoaded', () => {
    // انتخاب المان‌ها
    const canvas = document.getElementById('game-board');
    const ctx = canvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const highScoreElement = document.getElementById('high-score');
    const finalScoreElement = document.getElementById('final-score');
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const restartBtn = document.getElementById('restart-btn');
    const speedSelect = document.getElementById('speed');
    const wallsSelect = document.getElementById('walls');
    const specialFoodSelect = document.getElementById('special-food');
    const gameOverScreen = document.getElementById('game-over');
    const playAgainBtn = document.getElementById('play-again');
    const pauseScreen = document.getElementById('game-paused');
    const resumeBtn = document.getElementById('resume');
    const activePowers = document.querySelector('.active-powers');
    const activePowerName = document.getElementById('active-power-name');
    const powerTimer = document.getElementById('power-timer');
    const countdownScreen = document.getElementById('countdown');
    const countdownNumber = document.getElementById('countdown-number');

    // تنظیمات و متغیرهای بازی
    let snake = [];
    let food = {};
    let direction = 'right';
    let newDirection = 'right';
    let gameSpeed = 150; // سرعت پیش‌فرض
    let originalGameSpeed = 150;
    let score = 0;
    let highScore = localStorage.getItem('snakeHighScore') || 0;
    let gameRunning = false;
    let gamePaused = false;
    let wallsMode = 'stop'; // حالت برخورد با دیوار
    let specialFoodsEnabled = true;
    let foodCollected = false;
    let gameInterval;
    let countdownInterval;
    let gridSize = 20; // اندازه هر سلول
    let snakeGradient;
    let gridVisible = true;
    
    let fruitImages = {}; // برای ذخیره تصاویر میوه‌ها
    
    // قدرت‌های فعال
    let activePowerType = null;
    let activePowerEndTime = 0;
    let hasWallShield = false;
    let powerCheckInterval;

    // تعریف انواع میوه‌ها
    const foodTypes = {
        APPLE: { 
            type: 'apple', 
            color: '--food-color', 
            points: 10, 
            probability: 45,
            effect: null,
            image: 'images/apple.png'
        },
        BANANA: { 
            type: 'banana', 
            color: '--food-color-banana', 
            points: 20, 
            probability: 25,
            effect: null,
            image: 'images/banana.png'
        },
        BLUEBERRY: { 
            type: 'blueberry', 
            color: '--food-color-blueberry', 
            points: 15, 
            probability: 10,
            effect: activateSpeedBoost,
            image: 'images/blueberry.png'
        },
        ORANGE: { 
            type: 'orange', 
            color: '--food-color-orange', 
            points: 15, 
            probability: 10,
            effect: activateWallShield,
            image: 'images/orange.png'
        },
        GOLDEN: { 
            type: 'golden', 
            color: '--food-color-golden', 
            points: 50, 
            probability: 5,
            effect: null,
            image: 'images/golden-apple.png'
        },
        SPECIAL: { 
            type: 'special', 
            color: '--food-color-special', 
            points: 30, 
            probability: 5,
            effect: activateRandomPower,
            image: 'images/special-fruit.png'
        }
    };

    // بارگذاری تصاویر میوه‌ها
    function loadFruitImages() {
        // ساخت آرایه برای اطمینان از بارگذاری کامل تصاویر
        const promises = [];
        
        Object.values(foodTypes).forEach(foodType => {
            const img = new Image();
            const promise = new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = () => {
                    console.error(`Error loading image: ${foodType.image}`);
                    resolve(); // حتی با خطا هم ادامه بده
                };
            });
            
            img.src = foodType.image;
            fruitImages[foodType.type] = img;
            promises.push(promise);
        });
        
        // بازگشت promise همه تصاویر
        return Promise.all(promises);
    }

    // تنظیم اندازه کنواس
    function setupCanvas() {
        // محاسبه اندازه مناسب برای کنواس
        const container = document.querySelector('.game-board-container');
        const containerWidth = container.offsetWidth;
        
        // اطمینان از اینکه تعداد سلول‌ها مضرب عدد 2 است
        const cellCount = Math.floor(containerWidth / gridSize);
        const canvasSize = cellCount * gridSize;
        
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        
        // ایجاد گرادیان برای مار
        snakeGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        snakeGradient.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--snake-color').trim());
        snakeGradient.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--snake-head-color').trim());
    }

    // مقداردهی اولیه بازی
    function initGame() {
        clearInterval(gameInterval);
        clearInterval(powerCheckInterval);
        clearInterval(countdownInterval);
        
        // بارگذاری تصاویر میوه‌ها
        loadFruitImages().then(() => {
            console.log("All fruit images loaded successfully!");
        }).catch(error => {
            console.error("Error loading fruit images:", error);
        });
        
        setupCanvas();
        resetGame();
        
        highScoreElement.textContent = highScore;
        updateSpeedFromSelect();
        originalGameSpeed = gameSpeed;
        wallsMode = wallsSelect.value;
        specialFoodsEnabled = specialFoodSelect.value === 'on';
        
        // نمایش صفحه شروع بازی
        gameOverScreen.classList.add('hidden');
        pauseScreen.classList.add('hidden');
        countdownScreen.classList.add('hidden');
        activePowers.classList.add('hidden');
        
        // غیرفعال کردن دکمه مکث
        pauseBtn.disabled = true;
        
        // شروع بررسی قدرت‌ها
        powerCheckInterval = setInterval(checkActivePowers, 1000);
    }

    // بررسی قدرت‌های فعال
    function checkActivePowers() {
        if (activePowerType && Date.now() > activePowerEndTime) {
            deactivateCurrentPower();
        }
        
        if (activePowerType) {
            // بروزرسانی نشانگر زمان
            const remainingTime = Math.max(0, activePowerEndTime - Date.now());
            const totalDuration = (activePowerType === 'speedBoost') ? 15000 : 20000;
            const percentage = (remainingTime / totalDuration) * 100;
            powerTimer.style.setProperty('--progress', `${percentage}%`);
            powerTimer.firstElementChild.style.width = `${percentage}%`;
        }
    }

    // فعال‌سازی افزایش سرعت
    function activateSpeedBoost() {
        deactivateCurrentPower();
        
        if (gameRunning && !gamePaused) {
            clearInterval(gameInterval);
            gameSpeed = originalGameSpeed * 0.6; // افزایش سرعت
            gameInterval = setInterval(update, gameSpeed);
        }
        
        activePowerType = 'speedBoost';
        activePowerEndTime = Date.now() + 15000; // 15 ثانیه
        
        // نمایش قدرت فعال
        activePowerName.textContent = 'افزایش سرعت';
        activePowers.classList.remove('hidden');
        powerTimer.innerHTML = '<div></div>';
    }

    // فعال‌سازی محافظ دیوار
    function activateWallShield() {
        deactivateCurrentPower();
        
        hasWallShield = true;
        activePowerType = 'wallShield';
        activePowerEndTime = Date.now() + 20000; // 20 ثانیه
        
        // نمایش قدرت فعال
        activePowerName.textContent = 'محافظ دیوار';
        activePowers.classList.remove('hidden');
        powerTimer.innerHTML = '<div></div>';
    }

    // فعال‌سازی قدرت تصادفی
    function activateRandomPower() {
        const randomPower = Math.random() < 0.5 ? activateSpeedBoost : activateWallShield;
        randomPower();
    }

    // غیرفعال‌سازی قدرت فعلی
    function deactivateCurrentPower() {
        if (activePowerType === 'speedBoost') {
            // بازگشت به سرعت عادی
            if (gameRunning && !gamePaused) {
                clearInterval(gameInterval);
                gameSpeed = originalGameSpeed;
                gameInterval = setInterval(update, gameSpeed);
            }
        } else if (activePowerType === 'wallShield') {
            hasWallShield = false;
        }
        
        activePowerType = null;
        activePowers.classList.add('hidden');
    }

    // بازنشانی بازی
    function resetGame() {
        // ایجاد مار در وسط صفحه
        const centerPos = Math.floor((canvas.width / gridSize) / 2) * gridSize;
        snake = [
            { x: centerPos, y: centerPos },
            { x: centerPos - gridSize, y: centerPos },
            { x: centerPos - (2 * gridSize), y: centerPos }
        ];
        
        direction = 'right';
        newDirection = 'right';
        score = 0;
        scoreElement.textContent = '0';
        gameRunning = false;
        gamePaused = false;
        
        // بازنشانی قدرت‌ها
        activePowerType = null;
        activePowerEndTime = 0;
        hasWallShield = false;
        activePowers.classList.add('hidden');
        
        // ایجاد غذای جدید
        generateFood();
        
        // اولین رندر بازی
        render();
    }

    // انتخاب نوع غذا بر اساس احتمال
    function selectFoodType() {
        if (!specialFoodsEnabled) {
            return foodTypes.APPLE;
        }
        
        // محاسبه مجموع احتمالات
        const totalProbability = Object.values(foodTypes).reduce((total, food) => total + food.probability, 0);
        
        // انتخاب عدد تصادفی بر اساس احتمالات
        let random = Math.random() * totalProbability;
        let cumulativeProbability = 0;
        
        for (const foodType of Object.values(foodTypes)) {
            cumulativeProbability += foodType.probability;
            if (random <= cumulativeProbability) {
                return foodType;
            }
        }
        
        // حالت پیش‌فرض
        return foodTypes.APPLE;
    }

    // ایجاد غذای جدید در موقعیتی که با مار تداخل ندارد
    function generateFood() {
        let validPosition = false;
        let newFood;
        
        while (!validPosition) {
            const maxPos = (canvas.width / gridSize) - 1;
            newFood = {
                x: Math.floor(Math.random() * maxPos) * gridSize,
                y: Math.floor(Math.random() * maxPos) * gridSize,
                type: selectFoodType()
            };
            
            // بررسی تداخل با مار
            validPosition = true;
            for (let segment of snake) {
                if (segment.x === newFood.x && segment.y === newFood.y) {
                    validPosition = false;
                    break;
                }
            }
        }
        
        food = newFood;
        foodCollected = false;
    }

    // رندر کردن بازی
    function render() {
        // پاک کردن کنواس
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // رسم پس‌زمینه شبکه‌ای
        if (gridVisible) {
            drawGrid();
        }
        
        // رسم غذا
        drawFood();
        
        // رسم مار
        drawSnake();
    }

    // رسم پس‌زمینه شبکه‌ای
    function drawGrid() {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // خطوط عمودی
        for (let x = 0; x <= canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // خطوط افقی
        for (let y = 0; y <= canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }

    // رسم غذا با تصویر میوه
    function drawFood() {
        // رسم تصویر میوه
        const img = fruitImages[food.type.type];
        
        // افکت هاله
        const foodColor = getComputedStyle(document.documentElement).getPropertyValue(food.type.color).trim();
        const pulseSize = Math.sin(Date.now() / 200) * 2;
        
        if (!foodCollected) {
            ctx.strokeStyle = foodColor + '80';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(food.x + gridSize/2, food.y + gridSize/2, gridSize/2 + 3 + pulseSize, 0, 2 * Math.PI);
            ctx.stroke();
        }
        
        // افکت ویژه برای میوه‌های خاص
        if (food.type === foodTypes.GOLDEN || food.type === foodTypes.SPECIAL) {
            const glowSize = Math.sin(Date.now() / 150) * 3 + 5;
            ctx.strokeStyle = foodColor + '40';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(food.x + gridSize/2, food.y + gridSize/2, gridSize/2 + glowSize, 0, 2 * Math.PI);
            ctx.stroke();
        }
        
        // برای اطمینان از اینکه تصاویر لود شده‌اند
        if (img && img.complete && img.naturalHeight !== 0) {
            // رسم تصویر با اندازه مناسب
            const imgSize = gridSize * 1.2;
            ctx.drawImage(img, food.x - gridSize*0.1, food.y - gridSize*0.1, imgSize, imgSize);
            
            // برای اشکال‌زدایی
            console.log(`Drawing image: ${food.type.type}, size: ${imgSize}`);
        } else {
            // در صورت عدم بارگذاری تصویر، از دایره رنگی استفاده کن
            console.warn(`Image not loaded for: ${food.type.type}`);
            ctx.fillStyle = foodColor;
            ctx.beginPath();
            ctx.arc(food.x + gridSize/2, food.y + gridSize/2, gridSize/2, 0, 2 * Math.PI);
            ctx.fill();
            
            // افکت درخشان
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.beginPath();
            ctx.arc(food.x + gridSize/2 - 2, food.y + gridSize/2 - 2, gridSize/6, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    // رسم مار
    function drawSnake() {
        // رسم بدنه مار
        for (let i = 0; i < snake.length; i++) {
            const segment = snake[i];
            
            // سر مار با رنگ متفاوت
            if (i === 0) {
                // اگر قدرت فعال باشد، رنگ سر تغییر کند
                if (activePowerType === 'speedBoost') {
                    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--power-speed').trim();
                } else if (activePowerType === 'wallShield') {
                    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--power-shield').trim();
                } else {
                    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--snake-head-color').trim();
                }
                
                // رسم سر مار
                ctx.beginPath();
                ctx.roundRect(segment.x, segment.y, gridSize, gridSize, 8);
                ctx.fill();
                
                // رسم چشم‌ها
                ctx.fillStyle = 'white';
                const eyeSize = gridSize / 6;
                const eyeOffset = gridSize / 3;
                
                // موقعیت چشم‌ها بر اساس جهت
                let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
                
                switch(direction) {
                    case 'up':
                        leftEyeX = segment.x + eyeOffset;
                        leftEyeY = segment.y + eyeOffset;
                        rightEyeX = segment.x + gridSize - eyeOffset - eyeSize;
                        rightEyeY = segment.y + eyeOffset;
                        break;
                    case 'down':
                        leftEyeX = segment.x + gridSize - eyeOffset - eyeSize;
                        leftEyeY = segment.y + gridSize - eyeOffset - eyeSize;
                        rightEyeX = segment.x + eyeOffset;
                        rightEyeY = segment.y + gridSize - eyeOffset - eyeSize;
                        break;
                    case 'left':
                        leftEyeX = segment.x + eyeOffset;
                        leftEyeY = segment.y + eyeOffset;
                        rightEyeX = segment.x + eyeOffset;
                        rightEyeY = segment.y + gridSize - eyeOffset - eyeSize;
                        break;
                    case 'right':
                        leftEyeX = segment.x + gridSize - eyeOffset - eyeSize;
                        leftEyeY = segment.y + gridSize - eyeOffset - eyeSize;
                        rightEyeX = segment.x + gridSize - eyeOffset - eyeSize;
                        rightEyeY = segment.y + eyeOffset;
                        break;
                }
                
                // رسم چشم‌ها
                ctx.beginPath();
                ctx.arc(leftEyeX + eyeSize/2, leftEyeY + eyeSize/2, eyeSize, 0, 2 * Math.PI);
                ctx.arc(rightEyeX + eyeSize/2, rightEyeY + eyeSize/2, eyeSize, 0, 2 * Math.PI);
                ctx.fill();
                
                // رسم مردمک‌ها
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(leftEyeX + eyeSize/2, leftEyeY + eyeSize/2, eyeSize/2, 0, 2 * Math.PI);
                ctx.arc(rightEyeX + eyeSize/2, rightEyeY + eyeSize/2, eyeSize/2, 0, 2 * Math.PI);
                ctx.fill();
                
                // افکت محافظ دیوار
                if (activePowerType === 'wallShield') {
                    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--power-shield').trim() + '80';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.roundRect(segment.x - 2, segment.y - 2, gridSize + 4, gridSize + 4, 10);
                    ctx.stroke();
                }
            } 
            // بدنه مار
            else {
                // رنگ بدنه با گرادیان بر اساس موقعیت
                const colorPos = i / snake.length;
                const green = Math.floor(130 + (colorPos * 70));
                
                // اگر قدرت فعال باشد، رنگ بدنه هم متناسب با آن تغییر کند
                if (activePowerType === 'speedBoost') {
                    const blue = Math.floor(200 - (colorPos * 100));
                    ctx.fillStyle = `rgb(0, ${green}, ${blue})`;
                } else if (activePowerType === 'wallShield') {
                    const red = Math.floor(200 - (colorPos * 100));
                    ctx.fillStyle = `rgb(${red}, ${green}, 0)`;
                } else {
                    ctx.fillStyle = `rgb(100, ${green}, 124)`;
                }
                
                const radius = i === snake.length - 1 ? 8 : 4;
                ctx.beginPath();
                ctx.roundRect(segment.x, segment.y, gridSize, gridSize, radius);
                ctx.fill();
                
                // افکت انعکاس نور روی بدنه
                if (i % 3 === 0) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
                    ctx.beginPath();
                    ctx.arc(segment.x + gridSize/3, segment.y + gridSize/3, gridSize/6, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
    }

    // بروزرسانی منطق بازی
    function update() {
        // اعمال تغییر جهت
        direction = newDirection;
        
        // تعیین موقعیت جدید سر مار
        const head = { x: snake[0].x, y: snake[0].y };
        
        switch (direction) {
            case 'up':
                head.y -= gridSize;
                break;
            case 'down':
                head.y += gridSize;
                break;
            case 'left':
                head.x -= gridSize;
                break;
            case 'right':
                head.x += gridSize;
                break;
        }
        
        // بررسی برخورد با دیوار
        if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
            if (wallsMode === 'stop' && !hasWallShield) {
                // پایان بازی
                gameOver();
                return;
            } else {
                // عبور از دیوار
                if (head.x < 0) head.x = canvas.width - gridSize;
                if (head.x >= canvas.width) head.x = 0;
                if (head.y < 0) head.y = canvas.height - gridSize;
                if (head.y >= canvas.height) head.y = 0;
            }
        }
        
        // بررسی برخورد با خود
        for (let i = 0; i < snake.length; i++) {
            if (head.x === snake[i].x && head.y === snake[i].y) {
                gameOver();
                return;
            }
        }
        
        // بررسی برخورد با غذا
        if (head.x === food.x && head.y === food.y) {
            foodCollected = true;
            
            // افزایش امتیاز
            score += food.type.points;
            scoreElement.textContent = score;
            
            // اعمال اثر میوه
            if (food.type.effect) {
                food.type.effect();
            }
            
            // بررسی و بروزرسانی بیشترین امتیاز
            if (score > highScore) {
                highScore = score;
                highScoreElement.textContent = highScore;
                localStorage.setItem('snakeHighScore', highScore);
            }
            
            // تولید غذای جدید
            generateFood();
        } else {
            // حذف دم مار اگر غذا نخورده باشد
            snake.pop();
        }
        
        // اضافه کردن سر جدید به مار
        snake.unshift(head);
        
        // رندر بازی
        render();
    }

    // پایان بازی
    function gameOver() {
        clearInterval(gameInterval);
        clearInterval(powerCheckInterval);
        
        gameRunning = false;
        
        // مخفی کردن قدرت‌های فعال
        activePowers.classList.add('hidden');
        
        // نمایش صفحه پایان بازی
        finalScoreElement.textContent = score;
        gameOverScreen.classList.remove('hidden');
        
        // بروزرسانی وضعیت دکمه‌ها
        startBtn.disabled = false;
        pauseBtn.disabled = true;
    }

    // شمارش معکوس قبل از شروع بازی
    function startCountdown(callback) {
        let count = 3;
        countdownNumber.textContent = count;
        countdownScreen.classList.remove('hidden');
        
        countdownInterval = setInterval(() => {
            count--;
            
            if (count <= 0) {
                clearInterval(countdownInterval);
                countdownScreen.classList.add('hidden');
                callback();
                return;
            }
            
            countdownNumber.textContent = count;
        }, 1000);
    }

    // شروع بازی با شمارش معکوس
    function startGame() {
        if (!gameRunning) {
            resetGame();
            
            startCountdown(() => {
                gameRunning = true;
                gamePaused = false;
                
                // شروع حلقه بازی
                gameInterval = setInterval(update, gameSpeed);
                
                // بروزرسانی وضعیت دکمه‌ها
                startBtn.disabled = true;
                pauseBtn.disabled = false;
            });
        }
    }

    // توقف موقت بازی
    function pauseGame() {
        if (gameRunning && !gamePaused) {
            clearInterval(gameInterval);
            gamePaused = true;
            
            // نمایش صفحه توقف
            pauseScreen.classList.remove('hidden');
            
            // بروزرسانی وضعیت دکمه‌ها
            pauseBtn.disabled = true;
        }
    }

    // ادامه بازی با شمارش معکوس
    function resumeGame() {
        if (gameRunning && gamePaused) {
            pauseScreen.classList.add('hidden');
            
            startCountdown(() => {
                gameInterval = setInterval(update, gameSpeed);
                gamePaused = false;
                
                // بروزرسانی وضعیت دکمه‌ها
                pauseBtn.disabled = false;
            });
        }
    }

    // شروع مجدد بازی با شمارش معکوس
    function restartGame() {
        clearInterval(gameInterval);
        clearInterval(powerCheckInterval);
        clearInterval(countdownInterval);
        
        resetGame();
        gameOverScreen.classList.add('hidden');
        pauseScreen.classList.add('hidden');
        
        // شروع مجدد اینتروال‌ها
        powerCheckInterval = setInterval(checkActivePowers, 1000);
        
        // شروع مجدد بازی با شمارش معکوس
        startCountdown(() => {
            gameRunning = true;
            gamePaused = false;
            
            // شروع حلقه بازی
            gameInterval = setInterval(update, gameSpeed);
            
            // بروزرسانی وضعیت دکمه‌ها
            startBtn.disabled = true;
            pauseBtn.disabled = false;
        });
    }

    // بروزرسانی سرعت بازی بر اساس مقدار انتخاب شده
    function updateSpeedFromSelect() {
        const speedValue = speedSelect.value;
        
        switch (speedValue) {
            case 'slow':
                gameSpeed = 200;
                break;
            case 'medium':
                gameSpeed = 150;
                break;
            case 'fast':
                gameSpeed = 100;
                break;
        }
        
        originalGameSpeed = gameSpeed;
        
        // بروزرسانی سرعت بازی در حال اجرا
        if (gameRunning && !gamePaused) {
            clearInterval(gameInterval);
            gameInterval = setInterval(update, gameSpeed);
        }
    }

    // مدیریت کلیدهای فشرده شده
    function handleKeyDown(e) {
        // جلوگیری از اسکرول صفحه با کلیدهای جهت در همه حالت‌ها
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
        }
        
        if (gameRunning) {
            switch (e.key) {
                case 'ArrowUp':
                    if (direction !== 'down') {
                        newDirection = 'up';
                    }
                    break;
                case 'ArrowDown':
                    if (direction !== 'up') {
                        newDirection = 'down';
                    }
                    break;
                case 'ArrowLeft':
                    if (direction !== 'right') {
                        newDirection = 'left';
                    }
                    break;
                case 'ArrowRight':
                    if (direction !== 'left') {
                        newDirection = 'right';
                    }
                    break;
                case 'p':
                case 'P':
                    if (!gamePaused) {
                        pauseGame();
                    } else {
                        resumeGame();
                    }
                    break;
            }
        }
    }

    // مدیریت لمس برای دستگاه‌های موبایل
    let touchStartX = 0;
    let touchStartY = 0;
    
    function handleTouchStart(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
    }
    
    function handleTouchMove(e) {
        if (!gameRunning || !e.touches || e.touches.length === 0) return;
        
        // جلوگیری از اسکرول صفحه
        e.preventDefault();
        
        const touchEndX = e.touches[0].clientX;
        const touchEndY = e.touches[0].clientY;
        
        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;
        
        // تشخیص جهت کشیدن اگر حرکت کافی باشد
        if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
            if (Math.abs(dx) > Math.abs(dy)) {
                // حرکت افقی
                if (dx > 0 && direction !== 'left') {
                    newDirection = 'right';
                } else if (dx < 0 && direction !== 'right') {
                    newDirection = 'left';
                }
            } else {
                // حرکت عمودی
                if (dy > 0 && direction !== 'up') {
                    newDirection = 'down';
                } else if (dy < 0 && direction !== 'down') {
                    newDirection = 'up';
                }
            }
            
            // بروزرسانی نقطه شروع برای حرکت بعدی
            touchStartX = touchEndX;
            touchStartY = touchEndY;
        }
    }

    // اضافه کردن گوش‌دهنده‌های رویداد
    startBtn.addEventListener('click', startGame);
    pauseBtn.addEventListener('click', pauseGame);
    restartBtn.addEventListener('click', restartGame);
    playAgainBtn.addEventListener('click', restartGame);
    resumeBtn.addEventListener('click', resumeGame);
    speedSelect.addEventListener('change', updateSpeedFromSelect);
    wallsSelect.addEventListener('change', () => {
        wallsMode = wallsSelect.value;
    });
    specialFoodSelect.addEventListener('change', () => {
        specialFoodsEnabled = specialFoodSelect.value === 'on';
    });
    document.addEventListener('keydown', handleKeyDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    // مدیریت تغییر اندازه صفحه
    window.addEventListener('resize', () => {
        if (gameRunning) {
            pauseGame();
        }
        initGame();
    });

    // مقداردهی اولیه بازی
    initGame();
}); 