#include "encoder.h"
#include "frame.h"

Napi::FunctionReference VideoEncoderNative::constructor;

Napi::Object VideoEncoderNative::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoEncoderNative", {
        InstanceMethod("configure", &VideoEncoderNative::Configure),
        InstanceMethod("encode", &VideoEncoderNative::Encode),
        InstanceMethod("flush", &VideoEncoderNative::Flush),
        InstanceMethod("reset", &VideoEncoderNative::Reset),
        InstanceMethod("close", &VideoEncoderNative::Close),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("VideoEncoderNative", func);
    return exports;
}

VideoEncoderNative::VideoEncoderNative(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoEncoderNative>(info)
    , codecCtx_(nullptr)
    , codec_(nullptr)
    , swsCtx_(nullptr)
    , configured_(false)
    , avcAnnexB_(true)
    , width_(0)
    , height_(0) {

    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected 2 callbacks").ThrowAsJavaScriptException();
        return;
    }

    // Store callbacks directly instead of using ThreadSafeFunction for sync operations
    outputCallback_ = Napi::Persistent(info[0].As<Napi::Function>());
    errorCallback_ = Napi::Persistent(info[1].As<Napi::Function>());
}

VideoEncoderNative::~VideoEncoderNative() {
    if (swsCtx_) {
        sws_freeContext(swsCtx_);
    }

    if (codecCtx_) {
        avcodec_free_context(&codecCtx_);
    }
}

void VideoEncoderNative::Configure(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!info[0].IsObject()) {
        Napi::TypeError::New(env, "Config must be an object").ThrowAsJavaScriptException();
        return;
    }

    Napi::Object config = info[0].As<Napi::Object>();
    std::string codecName = config.Get("codec").As<Napi::String>().Utf8Value();

    codec_ = avcodec_find_encoder_by_name(codecName.c_str());
    if (!codec_) {
        Napi::Error::New(env, "Codec not found: " + codecName).ThrowAsJavaScriptException();
        return;
    }

    codecCtx_ = avcodec_alloc_context3(codec_);
    if (!codecCtx_) {
        Napi::Error::New(env, "Failed to allocate codec context").ThrowAsJavaScriptException();
        return;
    }

    // Required parameters
    width_ = config.Get("width").As<Napi::Number>().Int32Value();
    height_ = config.Get("height").As<Napi::Number>().Int32Value();

    codecCtx_->width = width_;
    codecCtx_->height = height_;
    codecCtx_->pix_fmt = AV_PIX_FMT_YUV420P;  // H.264 requires YUV420P

    // Time base - default to 1/1000000 (microseconds)
    codecCtx_->time_base = { 1, 1000000 };

    // Bitrate
    if (config.Has("bitrate")) {
        codecCtx_->bit_rate = config.Get("bitrate").As<Napi::Number>().Int64Value();
    } else {
        codecCtx_->bit_rate = 2000000;  // 2 Mbps default
    }

    // Framerate for GOP calculation
    if (config.Has("framerate")) {
        int fps = config.Get("framerate").As<Napi::Number>().Int32Value();
        codecCtx_->gop_size = fps;  // Keyframe every second
        codecCtx_->framerate = { fps, 1 };
    } else {
        codecCtx_->gop_size = 30;
        codecCtx_->framerate = { 30, 1 };
    }

    // Max B-frames
    codecCtx_->max_b_frames = 0;  // Disable B-frames for lower latency

    // H.264 specific options
    if (codecName == "libx264") {
        // Profile
        if (config.Has("profile")) {
            int profile = config.Get("profile").As<Napi::Number>().Int32Value();
            switch (profile) {
                case 66: av_opt_set(codecCtx_->priv_data, "profile", "baseline", 0); break;
                case 77: av_opt_set(codecCtx_->priv_data, "profile", "main", 0); break;
                case 100: av_opt_set(codecCtx_->priv_data, "profile", "high", 0); break;
                default: av_opt_set(codecCtx_->priv_data, "profile", "main", 0); break;
            }
        }

        // Preset for speed/quality tradeoff
        std::string latencyMode = "quality";
        if (config.Has("latencyMode")) {
            latencyMode = config.Get("latencyMode").As<Napi::String>().Utf8Value();
        }

        if (latencyMode == "realtime") {
            av_opt_set(codecCtx_->priv_data, "preset", "ultrafast", 0);
            av_opt_set(codecCtx_->priv_data, "tune", "zerolatency", 0);
        } else {
            av_opt_set(codecCtx_->priv_data, "preset", "medium", 0);
        }

        // AVC format (Annex B vs AVCC)
        if (config.Has("avcFormat")) {
            std::string format = config.Get("avcFormat").As<Napi::String>().Utf8Value();
            avcAnnexB_ = (format == "annexb");
        }
    } else if (codecName == "libvpx" || codecName == "libvpx-vp9") {
        // VP8/VP9 options
        codecCtx_->pix_fmt = AV_PIX_FMT_YUV420P;

        // Quality setting
        if (config.Has("bitrate")) {
            av_opt_set_int(codecCtx_->priv_data, "crf", 10, 0);
            av_opt_set_int(codecCtx_->priv_data, "b", codecCtx_->bit_rate, 0);
        }

        // Speed
        av_opt_set_int(codecCtx_->priv_data, "cpu-used", 4, 0);
    } else if (codecName == "libx265") {
        // HEVC options
        codecCtx_->pix_fmt = AV_PIX_FMT_YUV420P;
        av_opt_set(codecCtx_->priv_data, "preset", "medium", 0);
    }

    // Open codec
    int ret = avcodec_open2(codecCtx_, codec_, nullptr);
    if (ret < 0) {
        char errBuf[256];
        av_strerror(ret, errBuf, sizeof(errBuf));
        avcodec_free_context(&codecCtx_);
        Napi::Error::New(env, std::string("Failed to open codec: ") + errBuf).ThrowAsJavaScriptException();
        return;
    }

    configured_ = true;
}

void VideoEncoderNative::Encode(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (!configured_) {
        Napi::Error::New(env, "Encoder not configured").ThrowAsJavaScriptException();
        return;
    }

    // Get native frame from VideoFrameNative
    VideoFrameNative* frameWrapper = Napi::ObjectWrap<VideoFrameNative>::Unwrap(info[0].As<Napi::Object>());
    AVFrame* srcFrame = frameWrapper->GetFrame();

    if (!srcFrame) {
        Napi::Error::New(env, "Invalid frame").ThrowAsJavaScriptException();
        return;
    }

    int64_t timestamp = info[1].As<Napi::Number>().Int64Value();
    bool forceKeyframe = info[2].As<Napi::Boolean>().Value();

    // Clone and convert frame to YUV420P if needed
    AVFrame* frame = av_frame_alloc();
    frame->format = AV_PIX_FMT_YUV420P;
    frame->width = width_;
    frame->height = height_;
    frame->pts = timestamp;

    int ret = av_frame_get_buffer(frame, 0);
    if (ret < 0) {
        av_frame_free(&frame);
        char errBuf[256];
        av_strerror(ret, errBuf, sizeof(errBuf));
        Napi::Error::New(env, std::string("Failed to allocate frame: ") + errBuf).ThrowAsJavaScriptException();
        return;
    }

    // Convert pixel format if needed
    if (srcFrame->format != AV_PIX_FMT_YUV420P ||
        srcFrame->width != width_ ||
        srcFrame->height != height_) {

        if (!swsCtx_) {
            swsCtx_ = sws_getContext(
                srcFrame->width, srcFrame->height, (AVPixelFormat)srcFrame->format,
                width_, height_, AV_PIX_FMT_YUV420P,
                SWS_BILINEAR, nullptr, nullptr, nullptr
            );

            if (!swsCtx_) {
                av_frame_free(&frame);
                Napi::Error::New(env, "Failed to create scaler context").ThrowAsJavaScriptException();
                return;
            }
        }

        sws_scale(swsCtx_,
            srcFrame->data, srcFrame->linesize, 0, srcFrame->height,
            frame->data, frame->linesize
        );
    } else {
        av_frame_copy(frame, srcFrame);
    }

    // Set keyframe flag
    if (forceKeyframe) {
        frame->pict_type = AV_PICTURE_TYPE_I;
    }

    // Send frame to encoder
    ret = avcodec_send_frame(codecCtx_, frame);
    av_frame_free(&frame);

    if (ret < 0) {
        char errBuf[256];
        av_strerror(ret, errBuf, sizeof(errBuf));
        EmitError(env, std::string("Encode error: ") + errBuf);
        return;
    }

    // Receive encoded packets
    AVPacket* packet = av_packet_alloc();
    while (ret >= 0) {
        ret = avcodec_receive_packet(codecCtx_, packet);
        if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
            break;
        } else if (ret < 0) {
            char errBuf[256];
            av_strerror(ret, errBuf, sizeof(errBuf));
            EmitError(env, std::string("Encode error: ") + errBuf);
            break;
        }

        bool isKeyframe = (packet->flags & AV_PKT_FLAG_KEY) != 0;
        EmitChunk(env, packet, isKeyframe);
        av_packet_unref(packet);
    }
    av_packet_free(&packet);
}

void VideoEncoderNative::EmitChunk(Napi::Env env, AVPacket* packet, bool isKeyframe) {
    Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, packet->data, packet->size);

    Napi::Value extradataValue = env.Undefined();
    if (isKeyframe && codecCtx_->extradata && codecCtx_->extradata_size > 0) {
        extradataValue = Napi::Buffer<uint8_t>::Copy(env, codecCtx_->extradata, codecCtx_->extradata_size);
    }

    outputCallback_.Value().Call({
        buffer,
        Napi::Boolean::New(env, isKeyframe),
        Napi::Number::New(env, packet->pts),
        Napi::Number::New(env, packet->duration),
        extradataValue
    });
}

void VideoEncoderNative::EmitError(Napi::Env env, const std::string& message) {
    errorCallback_.Value().Call({ Napi::String::New(env, message) });
}

Napi::Value VideoEncoderNative::Flush(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    // Flush encoder by sending NULL frame
    if (configured_ && codecCtx_) {
        avcodec_send_frame(codecCtx_, nullptr);

        AVPacket* packet = av_packet_alloc();
        int ret;
        while ((ret = avcodec_receive_packet(codecCtx_, packet)) >= 0) {
            bool isKeyframe = (packet->flags & AV_PKT_FLAG_KEY) != 0;
            EmitChunk(env, packet, isKeyframe);
            av_packet_unref(packet);
        }
        av_packet_free(&packet);
    }

    Napi::Function callback = info[0].As<Napi::Function>();
    callback.Call({ env.Null() });

    return env.Undefined();
}

void VideoEncoderNative::Reset(const Napi::CallbackInfo& info) {
    // Flush codec buffers
    if (codecCtx_) {
        avcodec_flush_buffers(codecCtx_);
    }
}

void VideoEncoderNative::Close(const Napi::CallbackInfo& info) {
    if (swsCtx_) {
        sws_freeContext(swsCtx_);
        swsCtx_ = nullptr;
    }

    if (codecCtx_) {
        avcodec_free_context(&codecCtx_);
        codecCtx_ = nullptr;
    }

    configured_ = false;
}
