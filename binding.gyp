{
  "targets": [
    {
      "target_name": "webcodecs_node",
      "sources": [
        "native/addon.cpp",
        "native/frame.cpp",
        "native/audio.cpp",
        "native/encoder.cpp",
        "native/decoder.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "<!@(pkg-config --cflags-only-I libavcodec libavutil libswscale libswresample | sed 's/-I//g')"
      ],
      "libraries": [
        "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample)"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++17"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.15",
            "OTHER_CFLAGS": [
              "-std=c++17",
              "<!@(pkg-config --cflags libavcodec libavutil libswscale libswresample)"
            ],
            "OTHER_LDFLAGS": [
              "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample)"
            ]
          }
        }],
        ["OS=='linux'", {
          "cflags": [
            "-std=c++17",
            "<!@(pkg-config --cflags libavcodec libavutil libswscale libswresample)"
          ],
          "ldflags": [
            "<!@(pkg-config --libs libavcodec libavutil libswscale libswresample)"
          ]
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": ["/std:c++17"]
            }
          },
          "include_dirs": [
            "$(FFMPEG_DIR)/include"
          ],
          "libraries": [
            "-l$(FFMPEG_DIR)/lib/avcodec",
            "-l$(FFMPEG_DIR)/lib/avutil",
            "-l$(FFMPEG_DIR)/lib/swscale",
            "-l$(FFMPEG_DIR)/lib/swresample"
          ]
        }]
      ]
    }
  ]
}
