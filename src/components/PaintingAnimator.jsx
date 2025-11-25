import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, RotateCcw } from 'lucide-react';

export default function PaintingAnimator() {
    const [image, setImage] = useState(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);
    const [phase, setPhase] = useState('');
    const [speed, setSpeed] = useState(500);

    const canvasRef = useRef(null);
    const colorCanvasRef = useRef(null);
    const animationRef = useRef(null);
    const pathDataRef = useRef(null);
    const currentIndexRef = useRef(0);

    const MAX_SIZE = 1200;

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

        canvas.width = colorCanvas.width = width;
        canvas.height = colorCanvas.height = height;

        const ctx = canvas.getContext('2d');
        const colorCtx = colorCanvas.getContext('2d');

        colorCtx.drawImage(img, 0, 0, width, height);

        // Get image data for edge detection
        const imageData = colorCtx.getImageData(0, 0, width, height);
        const grayscale = toGrayscale(imageData);
        const edges = detectEdges(grayscale, width, height);

        // Generate optimized paths
        pathDataRef.current = generateOptimizedPaths(edges, width, height);

        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);

        setIsProcessing(false);
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

        // Collect fill points (sample every 3 pixels)
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

        if (canvasRef.current) {
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
            setProgress(Math.floor((endIdx / points.length) * 50));

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
            setProgress(51 + Math.floor((endIdx / points.length) * 49));

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
        <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-4xl font-bold text-gray-800 mb-2 text-center">
                    Painting Animator
                </h1>
                <p className="text-gray-600 mb-8 text-center">
                    Upload an image and watch it being drawn stroke by stroke
                </p>

                <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
                            <Upload size={20} />
                            <span>Upload Image</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </label>

                        {image && !isProcessing && (
                            <>
                                <button
                                    onClick={isAnimating ? togglePause : startAnimation}
                                    disabled={isAnimating && phase === 'complete'}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                >
                                    {isAnimating && !isPaused ? <Pause size={20} /> : <Play size={20} />}
                                    <span>{isAnimating && !isPaused ? 'Pause' : 'Start'}</span>
                                </button>

                                <button
                                    onClick={reset}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                                >
                                    <RotateCcw size={20} />
                                    <span>Reset</span>
                                </button>

                                <div className="flex items-center gap-3 ml-auto">
                                    <span className="text-sm text-gray-600 font-medium">Speed:</span>
                                    <input
                                        type="range"
                                        min="10"
                                        max="500"
                                        value={speed}
                                        onChange={(e) => setSpeed(Number(e.target.value))}
                                        className="w-32"
                                    />
                                    <span className="text-sm text-gray-600 font-medium w-12">{speed}x</span>
                                </div>
                            </>
                        )}
                    </div>

                    {isAnimating && (
                        <div className="mb-4">
                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                <span className="font-medium">
                                    {phase === 'outline' ? 'Drawing Outlines...' :
                                        phase === 'coloring' ? 'Adding Colors...' :
                                            phase === 'smoothing' ? 'Smoothing Outlines...' :
                                                'Complete!'}
                                </span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {isProcessing && (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Processing image...</p>
                        </div>
                    )}

                    <div className="flex justify-center items-center bg-gray-50 rounded-lg p-4 min-h-[400px]">
                        {!image ? (
                            <div className="text-center text-gray-400">
                                <Upload size={48} className="mx-auto mb-2 opacity-50" />
                                <p>Upload an image to begin</p>
                            </div>
                        ) : (
                            <div>
                                <canvas
                                    ref={canvasRef}
                                    className="max-w-full h-auto border border-gray-300 rounded shadow-lg"
                                />
                                <canvas ref={colorCanvasRef} style={{ display: 'none' }} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}