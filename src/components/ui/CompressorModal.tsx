'use client';

import { useState, useRef } from 'react';
import { X, ImageIcon, FileText, Layers, Download, UploadCloud, CheckCircle, Info, Mic } from 'lucide-react';
import JSZip from 'jszip';
import imageCompression from 'browser-image-compression';
import { showError, showSuccess } from '@/components/ui/Toast';
// @ts-ignore - lamejs는 타입 정의가 없음
import lamejs from '@breezystack/lamejs';

interface CompressorModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type TabType = 'image' | 'pdf' | 'webp' | 'audio';
type CompressionLevel = 'low' | 'medium' | 'high';

interface FilePreview {
    file: File;
    originalSize: number;
    estimatedSize: number;
    estimatedReduction: number;
}

// 압축 설정값
const COMPRESSION_CONFIG = {
    low: { maxSizeMB: 2, maxWidthOrHeight: 2560, quality: 0.95, label: '약하게 (화질 우선)', description: '원본의 70~90% 유지' },
    medium: { maxSizeMB: 1, maxWidthOrHeight: 1920, quality: 0.8, label: '보통', description: '원본의 40~60% 유지' },
    high: { maxSizeMB: 0.5, maxWidthOrHeight: 1280, quality: 0.6, label: '강하게 (용량 우선)', description: '원본의 15~30% 유지' },
};

// 오디오 압축 설정 (목표: 4.5MB 이하)
const AUDIO_COMPRESSION_CONFIG = {
    low: { bitrate: 128, sampleRate: 44100, channels: 1, label: '약하게 (고음질)', description: '128kbps MP3, 적당한 압축' },
    medium: { bitrate: 64, sampleRate: 22050, channels: 1, label: '보통 (권장)', description: '64kbps MP3, 균형 잡힌 압축' },
    high: { bitrate: 32, sampleRate: 16000, channels: 1, label: '강하게 (최대 압축)', description: '32kbps MP3, 최대 압축' },
};

export function CompressorModal({ isOpen, onClose }: CompressorModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>('image');
    const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [resultFile, setResultFile] = useState<{ url: string; name: string; originalSize: number; newSize: number } | null>(null);

    const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    const resetState = () => {
        setIsProcessing(false);
        setProgress(0);
        setStatusMessage('');
        setResultFile(null);
        setFilePreviews([]);
        setShowPreview(false);
        setSelectedFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        resetState();
    };

    const estimateCompression = (file: File, level: CompressionLevel): FilePreview => {
        let estimatedReduction: number;
        const sizeMB = file.size / (1024 * 1024);

        if (activeTab === 'audio') {
            const audioConfig = AUDIO_COMPRESSION_CONFIG[level];
            const assumedOriginalBitrate = 256;
            const targetBitrate = audioConfig.bitrate;
            estimatedReduction = Math.round((1 - targetBitrate / assumedOriginalBitrate) * 100);
            estimatedReduction = Math.max(20, Math.min(90, estimatedReduction));
        } else if (level === 'low') {
            estimatedReduction = Math.min(30, Math.max(10, sizeMB * 5));
        } else if (level === 'medium') {
            estimatedReduction = Math.min(60, Math.max(30, sizeMB * 10));
        } else {
            estimatedReduction = Math.min(85, Math.max(50, sizeMB * 15));
        }

        const estimatedSize = file.size * (1 - estimatedReduction / 100);

        return {
            file,
            originalSize: file.size,
            estimatedSize,
            estimatedReduction,
        };
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const fileArray = Array.from(files);
        setSelectedFiles(fileArray);

        const previews = fileArray.map(file => estimateCompression(file, compressionLevel));
        setFilePreviews(previews);
        setShowPreview(true);
    };

    const handleLevelChange = (level: CompressionLevel) => {
        setCompressionLevel(level);
        if (selectedFiles.length > 0) {
            const previews = selectedFiles.map(file => estimateCompression(file, level));
            setFilePreviews(previews);
        }
    };

    const startCompression = async () => {
        if (selectedFiles.length === 0) return;

        setShowPreview(false);
        setIsProcessing(true);

        try {
            if (activeTab === 'image') {
                await processImages(selectedFiles);
            } else if (activeTab === 'pdf') {
                await processPdfs(selectedFiles);
            } else if (activeTab === 'webp') {
                await processWebP(selectedFiles);
            } else if (activeTab === 'audio') {
                await processAudio(selectedFiles);
            }
        } catch (error: unknown) {
            showError((error instanceof Error ? error.message : String(error)) || '작업 중 오류가 발생했습니다.');
            setStatusMessage('오류 발생: ' + ((error instanceof Error ? error.message : String(error)) || '알 수 없는 오류'));
        } finally {
            setIsProcessing(false);
        }
    };

    // 1. Image Compression (Client-side)
    const processImages = async (files: File[]) => {
        setStatusMessage('이미지 압축 중...');
        const config = COMPRESSION_CONFIG[compressionLevel];

        const options = {
            maxSizeMB: config.maxSizeMB,
            maxWidthOrHeight: config.maxWidthOrHeight,
            useWebWorker: true,
        };

        if (files.length === 1) {
            const file = files[0];
            if (!file) return;
            setStatusMessage('이미지 압축 중...');

            try {
                const compressedFile = await imageCompression(file, options);
                const originalSize = file.size;
                const newSize = compressedFile.size;
                const reduction = Math.round((1 - newSize / originalSize) * 100);

                const url = URL.createObjectURL(compressedFile);
                setResultFile({
                    url,
                    name: `compressed_${file.name}`,
                    originalSize,
                    newSize,
                });
                setProgress(100);
                setStatusMessage('완료!');
                showSuccess(`이미지 압축 완료! (${reduction}% 감소)`);
            } catch (compressionError) {
                showError('압축에 실패했습니다. 다른 압축 강도를 시도해보세요.');
            }
            return;
        }

        const zip = new JSZip();
        let processedCount = 0;
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;

        for (const file of files) {
            try {
                setStatusMessage(`이미지 압축 중... (${processedCount + 1}/${files.length})`);

                const compressedFile = await imageCompression(file, options);
                totalOriginalSize += file.size;
                totalCompressedSize += compressedFile.size;

                const arrayBuffer = await compressedFile.arrayBuffer();
                zip.file(file.name, arrayBuffer);
                processedCount++;
                setProgress(Math.round((processedCount / files.length) * 90));
            } catch (e) {
                // 실패한 파일은 원본으로 추가
                const arrayBuffer = await file.arrayBuffer();
                zip.file(file.name, arrayBuffer);
                totalOriginalSize += file.size;
                totalCompressedSize += file.size;
                processedCount++;
            }
        }

        if (processedCount === 0) {
            showError('처리된 파일이 없습니다.');
            return;
        }

        setStatusMessage('ZIP 파일 생성 중...');
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const reduction = Math.round((1 - totalCompressedSize / totalOriginalSize) * 100);

        setResultFile({
            url,
            name: 'compressed_images.zip',
            originalSize: totalOriginalSize,
            newSize: content.size,
        });
        setProgress(100);
        setStatusMessage('완료!');
        showSuccess(`${processedCount}개 이미지 압축 완료! (평균 ${reduction}% 감소)`);
    };

    // 2. PDF 처리 (묶음)
    const processPdfs = async (files: File[]) => {
        setStatusMessage('PDF 처리 중...');

        if (files.length === 1) {
            const file = files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            setResultFile({
                url,
                name: file.name,
                originalSize: file.size,
                newSize: file.size,
            });
            setProgress(100);
            setStatusMessage('완료! (단일 PDF는 원본 유지)');
            showSuccess('PDF 처리 완료!');
            return;
        }

        const zip = new JSZip();
        let processedCount = 0;
        let totalSize = 0;

        for (const file of files) {
            try {
                setStatusMessage(`PDF 처리 중... (${processedCount + 1}/${files.length})`);
                const arrayBuffer = await file.arrayBuffer();
                zip.file(file.name, arrayBuffer);
                totalSize += file.size;
                processedCount++;
                setProgress(Math.round((processedCount / files.length) * 90));
            } catch (e) {
                // 실패한 파일 건너뜀
            }
        }

        if (processedCount === 0) {
            showError('처리된 파일이 없습니다.');
            return;
        }

        setStatusMessage('ZIP 파일 생성 중...');
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);

        setResultFile({
            url,
            name: 'documents.zip',
            originalSize: totalSize,
            newSize: content.size,
        });
        setProgress(100);
        setStatusMessage('완료!');
        showSuccess(`${processedCount}개 PDF 묶음 완료!`);
    };

    // 3. WebP 변환
    const processWebP = async (files: File[]) => {
        setStatusMessage('WebP 변환 중...');
        const config = COMPRESSION_CONFIG[compressionLevel];

        const convertToWebP = async (file: File): Promise<{ blob: Blob; originalSize: number }> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { reject(new Error('Canvas context error')); return; }
                    ctx.drawImage(img, 0, 0);

                    canvas.toBlob((blob) => {
                        if (blob) resolve({ blob, originalSize: file.size });
                        else reject(new Error('Conversion failed'));
                    }, 'image/webp', config.quality);
                };
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        };

        if (files.length === 1) {
            const file = files[0];
            if (!file) return;
            try {
                const { blob: webpBlob, originalSize } = await convertToWebP(file);
                const url = URL.createObjectURL(webpBlob);
                const name = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                const reduction = Math.round((1 - webpBlob.size / originalSize) * 100);

                setResultFile({
                    url,
                    name,
                    originalSize,
                    newSize: webpBlob.size,
                });
                setProgress(100);
                setStatusMessage('완료!');
                showSuccess(`WebP 변환 완료! (${reduction}% 감소)`);
            } catch (e) {
                showError('WebP 변환에 실패했습니다.');
            }
            return;
        }

        const zip = new JSZip();
        let processedCount = 0;
        let totalOriginalSize = 0;
        let totalNewSize = 0;

        for (const file of files) {
            try {
                setStatusMessage(`WebP 변환 중... (${processedCount + 1}/${files.length})`);
                const { blob: webpBlob, originalSize } = await convertToWebP(file);
                const name = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                const arrayBuffer = await webpBlob.arrayBuffer();
                zip.file(name, arrayBuffer);

                totalOriginalSize += originalSize;
                totalNewSize += webpBlob.size;
                processedCount++;
                setProgress(Math.round((processedCount / files.length) * 90));
            } catch (e) {
                // 실패한 파일 건너뜀
            }
        }

        if (processedCount === 0) {
            showError('변환된 파일이 없습니다.');
            return;
        }

        setStatusMessage('ZIP 파일 생성 중...');
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const reduction = Math.round((1 - totalNewSize / totalOriginalSize) * 100);

        setResultFile({
            url,
            name: 'converted_webp_images.zip',
            originalSize: totalOriginalSize,
            newSize: content.size,
        });
        setProgress(100);
        setStatusMessage('완료!');
        showSuccess(`${processedCount}개 WebP 변환 완료! (평균 ${reduction}% 감소)`);
    };

    // 4. Audio 압축 (M4A, MP3 등 → MP3로 변환)
    const processAudio = async (files: File[]) => {
        setStatusMessage('오디오 압축 중...');
        const config = AUDIO_COMPRESSION_CONFIG[compressionLevel];
        const targetSizeMB = 4.5;

        const compressAudioFile = async (file: File): Promise<{ blob: Blob; originalSize: number; extension: string }> => {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) {
                throw new Error('이 브라우저는 오디오 처리를 지원하지 않습니다.');
            }
            const audioContext = new AudioContextClass();

            try {
                const arrayBuffer = await file.arrayBuffer();

                let audioBuffer: AudioBuffer;
                try {
                    audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
                } catch (decodeError: unknown) {
                    throw new Error(`오디오 디코딩 실패: ${file.type || '알 수 없는 형식'}. MP3 또는 WAV 파일을 사용해주세요.`);
                }

                const targetSampleRate = Math.min(audioBuffer.sampleRate, config.sampleRate);
                const targetChannels = config.channels;
                const length = Math.floor(audioBuffer.duration * targetSampleRate);

                if (length <= 0) {
                    throw new Error('오디오 길이가 0입니다.');
                }

                const offlineContext = new OfflineAudioContext(targetChannels, length, targetSampleRate);
                const source = offlineContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(offlineContext.destination);
                source.start(0);

                const renderedBuffer = await offlineContext.startRendering();

                const mp3encoder = new lamejs.Mp3Encoder(targetChannels, targetSampleRate, config.bitrate);
                const mp3Data: Uint8Array[] = [];

                const samples = renderedBuffer.getChannelData(0);
                const sampleBlockSize = 1152;

                const int16Samples = new Int16Array(samples.length);
                for (let i = 0; i < samples.length; i++) {
                    const sample = samples[i];
                    const s = Math.max(-1, Math.min(1, sample ?? 0));
                    int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                for (let i = 0; i < int16Samples.length; i += sampleBlockSize) {
                    const sampleChunk = int16Samples.subarray(i, i + sampleBlockSize);
                    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
                    if (mp3buf.length > 0) {
                        mp3Data.push(new Uint8Array(mp3buf));
                    }
                }

                const mp3buf = mp3encoder.flush();
                if (mp3buf.length > 0) {
                    mp3Data.push(new Uint8Array(mp3buf));
                }

                const totalSize = mp3Data.reduce((acc, arr) => acc + arr.length, 0);

                if (totalSize === 0) {
                    throw new Error('MP3 인코딩 실패: 데이터가 생성되지 않았습니다. lamejs 라이브러리 문제일 수 있습니다.');
                }

                const blob = new Blob(mp3Data as BlobPart[], { type: 'audio/mpeg' });
                return { blob, originalSize: file.size, extension: 'mp3' };

            } catch (error) {
                throw error;
            } finally {
                audioContext.close();
            }
        };

        if (files.length === 1) {
            const file = files[0];
            if (!file) return;
            try {
                setStatusMessage(`오디오 압축 중... (${file.name})`);
                const { blob, originalSize, extension } = await compressAudioFile(file);
                const url = URL.createObjectURL(blob);
                const name = file.name.replace(/\.[^/.]+$/, "") + `_compressed.${extension}`;
                const reduction = Math.round((1 - blob.size / originalSize) * 100);

                setResultFile({
                    url,
                    name,
                    originalSize,
                    newSize: blob.size,
                });
                setProgress(100);
                setStatusMessage('완료!');

                if (blob.size <= targetSizeMB * 1024 * 1024) {
                    showSuccess(`오디오 압축 완료! (${reduction}% 감소, ${(blob.size / 1024 / 1024).toFixed(1)}MB)`);
                } else {
                    showSuccess(`압축 완료! 결과: ${(blob.size / 1024 / 1024).toFixed(1)}MB (4.5MB 초과 시 더 강한 압축 필요)`);
                }
            } catch (e: unknown) {
                showError((e instanceof Error ? e.message : String(e)) || '오디오 압축에 실패했습니다. 다른 파일을 시도해주세요.');
            }
            return;
        }

        const zip = new JSZip();
        let processedCount = 0;
        let totalOriginalSize = 0;
        let totalNewSize = 0;

        for (const file of files) {
            try {
                setStatusMessage(`오디오 압축 중... (${processedCount + 1}/${files.length})`);
                const { blob, originalSize, extension } = await compressAudioFile(file);
                const name = file.name.replace(/\.[^/.]+$/, "") + `_compressed.${extension}`;
                const arrayBuffer = await blob.arrayBuffer();
                zip.file(name, arrayBuffer);

                totalOriginalSize += originalSize;
                totalNewSize += blob.size;
                processedCount++;
                setProgress(Math.round((processedCount / files.length) * 90));
            } catch (e) {
                // 실패한 파일 건너뜀
            }
        }

        if (processedCount === 0) {
            showError('압축된 파일이 없습니다.');
            return;
        }

        setStatusMessage('ZIP 파일 생성 중...');
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const reduction = Math.round((1 - totalNewSize / totalOriginalSize) * 100);

        setResultFile({
            url,
            name: 'compressed_audio_files.zip',
            originalSize: totalOriginalSize,
            newSize: content.size,
        });
        setProgress(100);
        setStatusMessage('완료!');
        showSuccess(`${processedCount}개 오디오 압축 완료! (평균 ${reduction}% 감소)`);
    };

    // 총 예상 정보 계산
    const totalOriginalSize = filePreviews.reduce((sum, p) => sum + p.originalSize, 0);
    const totalEstimatedSize = filePreviews.reduce((sum, p) => sum + p.estimatedSize, 0);
    const avgReduction = filePreviews.length > 0
        ? Math.round(filePreviews.reduce((sum, p) => sum + p.estimatedReduction, 0) / filePreviews.length)
        : 0;

    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-5 border-b flex items-center justify-between bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Layers className="text-blue-600" />
                        만능 압축기
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => handleTabChange('image')}
                        className={`flex-1 py-3 font-medium text-xs transition-all flex items-center justify-center gap-1 ${activeTab === 'image' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <ImageIcon className="w-4 h-4" /> 이미지
                    </button>
                    <button
                        onClick={() => handleTabChange('audio')}
                        className={`flex-1 py-3 font-medium text-xs transition-all flex items-center justify-center gap-1 ${activeTab === 'audio' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Mic className="w-4 h-4" /> 오디오
                    </button>
                    <button
                        onClick={() => handleTabChange('pdf')}
                        className={`flex-1 py-3 font-medium text-xs transition-all flex items-center justify-center gap-1 ${activeTab === 'pdf' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <FileText className="w-4 h-4" /> PDF
                    </button>
                    <button
                        onClick={() => handleTabChange('webp')}
                        className={`flex-1 py-3 font-medium text-xs transition-all flex items-center justify-center gap-1 ${activeTab === 'webp' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        <Layers className="w-4 h-4" /> WebP
                    </button>
                </div>

                {/* Options - 이미지/WebP/오디오 표시 (PDF 제외) */}
                {!isProcessing && !resultFile && activeTab !== 'pdf' && (
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                        <div className="flex items-center gap-2 mb-3">
                            <Info className="text-blue-600" />
                            <span className="text-sm font-bold text-gray-700">
                                {activeTab === 'audio' ? '오디오 압축 설정 (목표: 4.5MB 이하)' : '압축 강도 선택'}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {(['low', 'medium', 'high'] as CompressionLevel[]).map((level) => {
                                const config = activeTab === 'audio' ? AUDIO_COMPRESSION_CONFIG[level] : COMPRESSION_CONFIG[level];
                                return (
                                    <button
                                        key={level}
                                        onClick={() => handleLevelChange(level)}
                                        className={`p-3 rounded-xl border-2 transition-all text-left ${
                                            compressionLevel === level
                                                ? 'border-blue-500 bg-blue-100 shadow-md'
                                                : 'border-gray-200 bg-white hover:border-blue-300'
                                        }`}
                                    >
                                        <div className="font-bold text-sm text-gray-800">{config.label}</div>
                                        <div className="text-xs text-gray-500 mt-1">{config.description}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto min-h-[300px] flex flex-col items-center justify-center">

                    {/* 초기 상태: 파일 선택 */}
                    {!isProcessing && !resultFile && !showPreview && (
                        <div
                            className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-10 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-4 text-blue-600">
                                <UploadCloud className="w-10 h-10" />
                            </div>
                            <p className="text-lg font-bold text-gray-700 mb-2">
                                {activeTab === 'image' && '이미지 파일 선택 (PNG, JPG, GIF)'}
                                {activeTab === 'audio' && '오디오 파일 선택 (M4A, MP3, WAV 등)'}
                                {activeTab === 'pdf' && 'PDF 파일 선택'}
                                {activeTab === 'webp' && '변환할 이미지 선택'}
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                                여러 파일 선택 가능 (Ctrl/Cmd + 클릭)
                            </p>
                            <button className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md">
                                파일 불러오기
                            </button>
                        </div>
                    )}

                    {/* 미리보기 상태: 예상 압축률 표시 */}
                    {showPreview && !isProcessing && !resultFile && (
                        <div className="w-full">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Info className="text-blue-600" />
                                압축 예상 결과
                            </h3>

                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 mb-4">
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-2xl font-bold">{filePreviews.length}개</div>
                                        <div className="text-xs opacity-80">선택된 파일</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold">{formatFileSize(totalOriginalSize)}</div>
                                        <div className="text-xs opacity-80">원본 크기</div>
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-green-300">~{avgReduction}%</div>
                                        <div className="text-xs opacity-80">예상 감소율</div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-white/20 text-center">
                                    <span className="text-sm">예상 결과: </span>
                                    <span className="font-bold">{formatFileSize(totalOriginalSize)}</span>
                                    <span className="mx-2">→</span>
                                    <span className="font-bold text-green-300">~{formatFileSize(totalEstimatedSize)}</span>
                                </div>
                            </div>

                            <div className="max-h-40 overflow-y-auto mb-4 border rounded-lg">
                                {filePreviews.map((preview, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-gray-50">
                                        <div className="flex items-center gap-2">
                                            {activeTab === 'audio' ? <Mic className="text-gray-400 w-4 h-4" /> : <ImageIcon className="text-gray-400 w-4 h-4" />}
                                            <span className="text-sm text-gray-700 truncate max-w-[200px]">{preview.file.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <span className="text-gray-500">{formatFileSize(preview.originalSize)}</span>
                                            <span className="text-gray-400">→</span>
                                            <span className="text-green-600 font-medium">~{formatFileSize(preview.estimatedSize)}</span>
                                            <span className="text-green-600 font-bold">(-{Math.round(preview.estimatedReduction)}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={resetState}
                                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={startCompression}
                                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg"
                                >
                                    {activeTab === 'image' && '압축 시작'}
                                    {activeTab === 'audio' && '오디오 압축 시작'}
                                    {activeTab === 'pdf' && 'ZIP 생성'}
                                    {activeTab === 'webp' && 'WebP 변환'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 처리 중 */}
                    {isProcessing && (
                        <div className="w-full max-w-md text-center">
                            <div className="mb-6 relative pt-4">
                                <div className="w-20 h-20 mx-auto border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pt-4 font-bold text-blue-600">
                                    {progress}%
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">{statusMessage}</h3>
                            <p className="text-gray-500 text-sm">잠시만 기다려주세요...</p>
                        </div>
                    )}

                    {/* 완료 */}
                    {resultFile && !isProcessing && (
                        <div className="w-full max-w-md text-center animate-in zoom-in duration-300">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 mx-auto text-green-600">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">작업 완료!</h3>
                            <p className="text-gray-600 mb-2 break-all">{resultFile.name}</p>

                            <div className="bg-gray-100 rounded-xl p-4 mb-6">
                                <div className="flex justify-center items-center gap-4 text-sm">
                                    <div className="text-center">
                                        <div className="text-gray-500">원본</div>
                                        <div className="font-bold text-gray-700">{formatFileSize(resultFile.originalSize)}</div>
                                    </div>
                                    <div className="text-2xl text-gray-400">→</div>
                                    <div className="text-center">
                                        <div className="text-gray-500">결과</div>
                                        <div className="font-bold text-green-600">{formatFileSize(resultFile.newSize)}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-gray-500">감소</div>
                                        <div className="font-bold text-green-600">
                                            {Math.round((1 - resultFile.newSize / resultFile.originalSize) * 100)}%
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 justify-center">
                                <a
                                    href={resultFile.url}
                                    download={resultFile.name}
                                    className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg hover:scale-105 transform"
                                >
                                    <Download className="w-5 h-5" /> 다운로드
                                </a>
                                <button
                                    onClick={resetState}
                                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                                >
                                    다른 파일
                                </button>
                            </div>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept={activeTab === 'pdf' ? 'application/pdf' : activeTab === 'audio' ? 'audio/*,.m4a,.mp3,.wav,.ogg,.webm' : 'image/*'}
                        onChange={handleFileSelect}
                    />
                </div>

                <div className="p-4 bg-gray-50 text-xs text-gray-400 text-center border-t">
                    * 모든 작업은 브라우저에서 처리됩니다. 서버에 저장되지 않습니다.
                </div>
            </div>
        </div>
    );
}
