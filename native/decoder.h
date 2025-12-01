#ifndef DECODER_H
#define DECODER_H

#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/frame.h>
#include <libavutil/imgutils.h>
}

class VideoDecoderNative : public Napi::ObjectWrap<VideoDecoderNative> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    VideoDecoderNative(const Napi::CallbackInfo& info);
    ~VideoDecoderNative();

private:
    static Napi::FunctionReference constructor;

    void Configure(const Napi::CallbackInfo& info);
    void Decode(const Napi::CallbackInfo& info);
    Napi::Value Flush(const Napi::CallbackInfo& info);
    void Reset(const Napi::CallbackInfo& info);
    void Close(const Napi::CallbackInfo& info);

    void EmitFrame(Napi::Env env, AVFrame* frame, int64_t timestamp, int64_t duration);
    void EmitError(Napi::Env env, const std::string& message);

    AVCodecContext* codecCtx_;
    const AVCodec* codec_;

    Napi::FunctionReference outputCallback_;
    Napi::FunctionReference errorCallback_;

    bool configured_;
};

#endif
