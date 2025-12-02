#ifndef HW_ACCEL_H
#define HW_ACCEL_H

#include <string>
#include <vector>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavutil/hwcontext.h>
}

namespace HWAccel {

// Hardware acceleration preference (matches WebCodecs spec)
enum class Preference {
    NoPreference,      // Try HW first, fall back to SW
    PreferHardware,    // Try HW first, fail if unavailable (optional)
    PreferSoftware     // Use SW only
};

// Hardware acceleration type
enum class Type {
    None,
    VideoToolbox,  // macOS
    NVENC,         // NVIDIA (encode)
    CUVID,         // NVIDIA (decode)
    QSV,           // Intel QuickSync
    VAAPI,         // Linux VA-API
    AMF,           // AMD
    MediaFoundation, // Windows
    V4L2M2M        // Linux embedded (RPi)
};

// Encoder info returned after selection
struct EncoderInfo {
    const AVCodec* codec;
    Type hwType;
    AVPixelFormat inputFormat;   // Required input pixel format
    AVPixelFormat swFormat;      // Software format if using HW frames
    bool requiresHWFrames;       // Whether to use AVHWFramesContext
    std::string name;
};

// Decoder info returned after selection
struct DecoderInfo {
    const AVCodec* codec;
    Type hwType;
    AVPixelFormat outputFormat;
    bool usesHWFrames;
    std::string name;
};

/**
 * Get list of available HW encoders for a codec type
 */
std::vector<std::string> getAvailableEncoders(const std::string& codecType);

/**
 * Get list of available HW decoders for a codec type
 */
std::vector<std::string> getAvailableDecoders(const std::string& codecType);

/**
 * Select best encoder based on preference and availability
 *
 * @param codecString WebCodecs codec string (e.g., "avc1.42E01E") or FFmpeg name
 * @param preference Hardware acceleration preference
 * @param width Video width (some HW encoders have limits)
 * @param height Video height
 * @return EncoderInfo with selected encoder, or nullptr codec if none found
 */
EncoderInfo selectEncoder(
    const std::string& codecString,
    Preference preference,
    int width,
    int height
);

/**
 * Select best decoder based on preference and availability
 */
DecoderInfo selectDecoder(
    const std::string& codecString,
    Preference preference,
    int width,
    int height
);

/**
 * Check if a specific HW encoder is available and functional
 */
bool isEncoderAvailable(const std::string& encoderName);

/**
 * Check if a specific HW decoder is available and functional
 */
bool isDecoderAvailable(const std::string& decoderName);

/**
 * Get the HW device type for an encoder/decoder name
 */
AVHWDeviceType getHWDeviceType(Type type);

/**
 * Create HW device context for a given type
 * Returns nullptr if not available
 */
AVBufferRef* createHWDeviceContext(Type type);

/**
 * Get human-readable name for HW type
 */
const char* getTypeName(Type type);

/**
 * Parse preference string from JavaScript
 */
Preference parsePreference(const std::string& pref);

} // namespace HWAccel

#endif // HW_ACCEL_H
