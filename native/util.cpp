#include <napi.h>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/avutil.h>
}

// Get FFmpeg version info
Napi::Value GetFFmpegVersion(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Object result = Napi::Object::New(env);
    result.Set("avcodec", Napi::String::New(env, av_version_info()));

    unsigned version = avcodec_version();
    char verStr[32];
    snprintf(verStr, sizeof(verStr), "%d.%d.%d",
        (version >> 16) & 0xFF,
        (version >> 8) & 0xFF,
        version & 0xFF);

    result.Set("avcodecVersion", Napi::String::New(env, verStr));

    return result;
}

// List available codecs
Napi::Value ListCodecs(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    Napi::Object result = Napi::Object::New(env);
    Napi::Array encoders = Napi::Array::New(env);
    Napi::Array decoders = Napi::Array::New(env);

    uint32_t encIdx = 0;
    uint32_t decIdx = 0;

    void* iter = nullptr;
    const AVCodec* codec;

    while ((codec = av_codec_iterate(&iter))) {
        if (av_codec_is_encoder(codec)) {
            Napi::Object codecObj = Napi::Object::New(env);
            codecObj.Set("name", Napi::String::New(env, codec->name));
            codecObj.Set("longName", Napi::String::New(env, codec->long_name ? codec->long_name : ""));
            codecObj.Set("type", Napi::String::New(env,
                codec->type == AVMEDIA_TYPE_VIDEO ? "video" :
                codec->type == AVMEDIA_TYPE_AUDIO ? "audio" : "other"));
            encoders.Set(encIdx++, codecObj);
        }
        if (av_codec_is_decoder(codec)) {
            Napi::Object codecObj = Napi::Object::New(env);
            codecObj.Set("name", Napi::String::New(env, codec->name));
            codecObj.Set("longName", Napi::String::New(env, codec->long_name ? codec->long_name : ""));
            codecObj.Set("type", Napi::String::New(env,
                codec->type == AVMEDIA_TYPE_VIDEO ? "video" :
                codec->type == AVMEDIA_TYPE_AUDIO ? "audio" : "other"));
            decoders.Set(decIdx++, codecObj);
        }
    }

    result.Set("encoders", encoders);
    result.Set("decoders", decoders);

    return result;
}

// Check if a specific codec is available
Napi::Value HasCodec(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Expected codec name and type").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string codecName = info[0].As<Napi::String>().Utf8Value();
    std::string type = info[1].As<Napi::String>().Utf8Value();  // "encoder" or "decoder"

    const AVCodec* codec = nullptr;
    if (type == "encoder") {
        codec = avcodec_find_encoder_by_name(codecName.c_str());
    } else {
        codec = avcodec_find_decoder_by_name(codecName.c_str());
    }

    return Napi::Boolean::New(env, codec != nullptr);
}

void InitUtil(Napi::Env env, Napi::Object exports) {
    exports.Set("getFFmpegVersion", Napi::Function::New(env, GetFFmpegVersion));
    exports.Set("listCodecs", Napi::Function::New(env, ListCodecs));
    exports.Set("hasCodec", Napi::Function::New(env, HasCodec));
}
