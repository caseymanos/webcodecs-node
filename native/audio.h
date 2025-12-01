#ifndef AUDIO_H
#define AUDIO_H

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/frame.h>
#include <libavutil/opt.h>
#include <libavutil/channel_layout.h>
#include <libswresample/swresample.h>
}

// AudioDataNative class - holds raw audio data
class AudioDataNative : public Napi::ObjectWrap<AudioDataNative> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    static Napi::Object NewInstance(Napi::Env env);
    static Napi::FunctionReference constructor;

    AudioDataNative(const Napi::CallbackInfo& info);
    ~AudioDataNative();

    AVFrame* GetFrame() const { return frame_; }

private:

    Napi::Value AllocationSize(const Napi::CallbackInfo& info);
    void CopyTo(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);

    AVFrame* frame_;
    bool closed_;
    std::string format_;
    int sampleRate_;
    int numberOfFrames_;
    int numberOfChannels_;
};

// AudioDecoderNative class
class AudioDecoderNative : public Napi::ObjectWrap<AudioDecoderNative> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    AudioDecoderNative(const Napi::CallbackInfo& info);
    ~AudioDecoderNative();

private:
    static Napi::FunctionReference constructor;

    void Configure(const Napi::CallbackInfo& info);
    void Decode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    void Reset(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);

    void EmitData(Napi::Env env, AVFrame* frame, int64_t timestamp);
    void EmitError(Napi::Env env, const std::string& message);

    AVCodecContext* codecCtx_;
    const AVCodec* codec_;
    SwrContext* swrCtx_;

    Napi::FunctionReference outputCallback_;
    Napi::FunctionReference errorCallback_;

    bool configured_;
    int sampleRate_;
    int channels_;
};

// AudioEncoderNative class
class AudioEncoderNative : public Napi::ObjectWrap<AudioEncoderNative> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    AudioEncoderNative(const Napi::CallbackInfo& info);
    ~AudioEncoderNative();

private:
    static Napi::FunctionReference constructor;

    void Configure(const Napi::CallbackInfo& info);
    void Encode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    void Reset(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);

    void EmitChunk(Napi::Env env, AVPacket* packet);
    void EmitError(Napi::Env env, const std::string& message);

    AVCodecContext* codecCtx_;
    const AVCodec* codec_;
    SwrContext* swrCtx_;

    Napi::FunctionReference outputCallback_;
    Napi::FunctionReference errorCallback_;

    bool configured_;
    int sampleRate_;
    int channels_;
    int frameSize_;  // Samples per frame for AAC
};

// Factory function
Napi::Value CreateAudioData(const Napi::CallbackInfo& info);

#endif
