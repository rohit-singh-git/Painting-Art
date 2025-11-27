import React, { useState, useRef, useEffect } from 'react';

export default function PaintingAnimator() {
    const [image, setImage] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState('');
    const [speed, setSpeed] = useState(100);
    const [loadError, setLoadError] = useState(false);

    const canvasRef = useRef(null);
    const colorCanvasRef = useRef(null);
    const animationRef = useRef(null);
    const pathDataRef = useRef(null);
    const currentIndexRef = useRef(0);

    const MAX_SIZE = 1000;

    // Use online images or replace with your local paths
    const sampleImages = [
        './1.jfif',
        './2.jfif',
        './3.jfif',
        './4.jfif',
        './5.jfif',
        './6.jfif',
        './7.jfif',
        './8.jfif',
        './9.jfif',
        './10.jfif',
        './11.jfif',
        './12.jpg',
        './img.jpg'
    ];

    // Load random image on mount
    useEffect(() => {
        loadRandomImage();
    }, []);

    const loadRandomImage = () => {
        setLoadError(false);
        const randomUrl = sampleImages[Math.floor(Math.random() * sampleImages.length)];
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            setImage(img);
            setImageLoaded(true);
        };

        img.onerror = () => {
            console.error('Failed to load image:', randomUrl);
            setLoadError(true);
            // Try loading another image
            setTimeout(loadRandomImage, 2000);
        };

        img.src = randomUrl;
    };

    const handleNewPainting = () => {
        reset();
        loadRandomImage();
    };

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    setImageLoaded(true);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    useEffect(() => {
        if (imageLoaded && image) {
            processImage(image);
            setImageLoaded(false);
        }
    }, [imageLoaded, image]);

    const processImage = (img) => {
        setIsProcessing(true);
        setProgress(0);
        setPhase('');

        let width = img.width;
        let height = img.height;

        if (width > MAX_SIZE || height > MAX_SIZE) {
            if (width > height) {
                height = (height / width) * MAX_SIZE;
                width = MAX_SIZE;
            } else {
                width = (width / height) * MAX_SIZE;
                height = MAX_SIZE;
            }
        }

        const canvas = canvasRef.current;
        const colorCanvas = colorCanvasRef.current;

        if (!canvas || !colorCanvas) {
            console.error('Canvas refs not available');
            setIsProcessing(false);
            return;
        }

        canvas.width = colorCanvas.width = width;
        canvas.height = colorCanvas.height = height;

        const ctx = canvas.getContext('2d');
        const colorCtx = colorCanvas.getContext('2d');

        // Draw the image to color canvas
        colorCtx.drawImage(img, 0, 0, width, height);

        // Get image data for edge detection
        const imageData = colorCtx.getImageData(0, 0, width, height);
        const grayscale = toGrayscale(imageData);
        const edges = detectEdges(grayscale, width, height);

        // Generate optimized paths
        pathDataRef.current = generateOptimizedPaths(edges, width, height);

        // Clear main canvas with white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        setIsProcessing(false);

        // Auto-start animation
        setTimeout(() => {
            startAnimation();
        }, 100);
    };

    const toGrayscale = (imageData) => {
        const data = imageData.data;
        const len = data.length;
        const grayscale = new Uint8Array(len / 4);

        for (let i = 0; i < len; i += 4) {
            grayscale[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        return grayscale;
    };

    const detectEdges = (grayscale, width, height) => {
        const edges = new Uint8Array(grayscale.length);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                const gx = -grayscale[idx - width - 1] + grayscale[idx - width + 1]
                    - 2 * grayscale[idx - 1] + 2 * grayscale[idx + 1]
                    - grayscale[idx + width - 1] + grayscale[idx + width + 1];

                const gy = -grayscale[idx - width - 1] - 2 * grayscale[idx - width] - grayscale[idx - width + 1]
                    + grayscale[idx + width - 1] + 2 * grayscale[idx + width] + grayscale[idx + width + 1];

                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edges[idx] = magnitude > 50 ? 255 : 0;
            }
        }

        return edges;
    };

    const generateOptimizedPaths = (edges, width, height) => {
        const outlinePoints = [];
        const fillPoints = [];

        // Collect outline points (sample every 3 pixels)
        for (let y = 0; y < height; y += 3) {
            for (let x = 0; x < width; x += 3) {
                if (edges[y * width + x] > 128) {
                    outlinePoints.push({ x, y });
                }
            }
        }

        // Collect fill points (sample every 2 pixels for better coverage)
        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                fillPoints.push({ x, y });
            }
        }

        return { outlinePoints, fillPoints, width, height };
    };

    const startAnimation = () => {
        if (!pathDataRef.current) return;

        setIsAnimating(true);
        setIsPaused(false);
        setPhase('outline');
        currentIndexRef.current = 0;
    };

    const togglePause = () => {
        setIsPaused(!isPaused);
    };

    const reset = () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
        setIsAnimating(false);
        setIsPaused(false);
        setProgress(0);
        setPhase('');
        currentIndexRef.current = 0;

        if (canvasRef.current && pathDataRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    const animate = () => {
        if (isPaused) {
            animationRef.current = requestAnimationFrame(animate);
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const colorCanvas = colorCanvasRef.current;
        const colorCtx = colorCanvas.getContext('2d');
        const pathData = pathDataRef.current;

        const pointsPerFrame = speed;

        if (phase === 'outline') {
            const points = pathData.outlinePoints;
            const startIdx = currentIndexRef.current;
            const endIdx = Math.min(startIdx + pointsPerFrame, points.length);

            ctx.fillStyle = '#000';
            ctx.beginPath();
            for (let i = startIdx; i < endIdx; i++) {
                const point = points[i];
                ctx.rect(point.x, point.y, 1, 1);
            }
            ctx.fill();

            currentIndexRef.current = endIdx;
            setProgress(Math.floor((endIdx / points.length) * 40));

            if (endIdx >= points.length) {
                setPhase('coloring');
                currentIndexRef.current = 0;
            }

            animationRef.current = requestAnimationFrame(animate);
        } else if (phase === 'coloring') {
            const points = pathData.fillPoints;
            const startIdx = currentIndexRef.current;
            const endIdx = Math.min(startIdx + pointsPerFrame, points.length);

            // Batch get pixel colors
            for (let i = startIdx; i < endIdx; i++) {
                const point = points[i];
                const imgData = colorCtx.getImageData(point.x, point.y, 1, 1).data;
                ctx.fillStyle = `rgb(${imgData[0]},${imgData[1]},${imgData[2]})`;
                ctx.fillRect(point.x, point.y, 3, 3);
            }

            currentIndexRef.current = endIdx;
            setProgress(41 + Math.floor((endIdx / points.length) * 59));

            if (endIdx >= points.length) {
                setIsAnimating(false);
                setPhase('complete');
                setProgress(100);
                return;
            }

            animationRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (isAnimating && !isPaused) {
            animate();
        }
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isAnimating, isPaused, phase, speed]);

    return (
        <div className='flex flex-col justify-center items-center text-center overflow-clip'>
            <div className='flex flex-col'>
                <button
                    onClick={handleNewPainting}
                    disabled={isProcessing}
                >
                    <span>🖌 New Painting</span>
                </button>

                <button className='w-fit text-center'>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                    />
                </button>

                {image && !isProcessing && (
                    <>
                        {isAnimating ? (
                            <button
                                onClick={togglePause}
                            >
                                {isPaused ? "▶︎ " : "⏸"}
                                <span>{isPaused ? 'Resume' : 'Pause'}</span>
                            </button>
                        ) : phase === 'complete' ? (
                            <button
                                onClick={handleNewPainting}
                            >
                                <span>↻ Restart</span>
                            </button>
                        ) : null}

                        <button
                            onClick={reset}
                        >
                            <span>🗘 Reset</span>
                        </button>

                        <div>
                            <span>Speed:</span>
                            <input
                                type="range"
                                min="10"
                                max="500"
                                value={speed}
                                onChange={(e) => setSpeed(Number(e.target.value))}
                            />
                            <span>{speed}x</span>
                        </div>
                    </>
                )}
            </div>

            {isAnimating && (
                <div>
                    <div>
                        <span>
                            {phase === 'outline' ? 'Drawing Outlines...' :
                                phase === 'coloring' ? 'Adding Colors...' : 'Complete!'}
                        </span>
                        <span>{progress}%</span>
                    </div>
                    <div>
                        <div
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}

            <div>
                <div>
                    {isProcessing ? (
                        <div>
                            <div></div>
                            <p>Processing image...</p>
                        </div>
                    ) : !image ? (
                        <div>
                            ⬆
                            <p>Loading...</p>
                        </div>
                    ) : (
                        <div className='h-auto'>
                            <canvas
                                ref={canvasRef}
                            />
                            <canvas ref={colorCanvasRef} style={{ display: 'none' }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}