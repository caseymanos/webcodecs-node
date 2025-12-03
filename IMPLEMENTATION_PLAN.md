# Implementation Plan: Fix Async Flush & Native Addon Loading

## Overview

This plan addresses two critical issues that affect production/serverless usage:

1. **Async flush() race condition** - `BlockingCall` can deadlock in resource-constrained environments (CI, serverless, containers)
2. **Native addon loading** - Custom loader should use `node-gyp-build` for proper prebuild discovery

## Issue 1: Async Flush Race Condition

### Current Problem

In `native/async_encoder.cpp` and `native/async_decoder.cpp`, the `ProcessFlush()` function uses `BlockingCall`:

```cpp
// async_encoder.cpp:711-714
tsfnFlush_.BlockingCall([](Napi::Env env, Napi::Function fn) {
    fn.Call({ env.Null() });
});
```

**Why this causes hangs:**
- `BlockingCall` blocks the C++ worker thread until the JS event loop processes the callback
- In resource-constrained environments, the JS event loop may be starved
- This creates a deadlock: C++ thread waits for JS, JS can't process because it's resource-limited

### Solution

Change `BlockingCall` to `NonBlockingCall` for the flush callback. The flush completion is already signaled properly through the ThreadSafeFunction mechanism.

### Files to Modify

1. **`native/async_encoder.cpp`**
   - Line 690-714: Change `tsfnOutput_.BlockingCall` to `NonBlockingCall` in flush loop
   - Line 711-714: Change `tsfnFlush_.BlockingCall` to `NonBlockingCall`

2. **`native/async_decoder.cpp`** (similar changes)
   - Find and update `BlockingCall` to `NonBlockingCall` in `ProcessFlush()`

### Code Changes

**async_encoder.cpp - ProcessFlush():**
```cpp
void VideoEncoderAsync::ProcessFlush() {
    if (!codecCtx_) {
        flushPending_ = false;
        flushCV_.notify_all();
        return;
    }

    // Send NULL frame to flush
    avcodec_send_frame(codecCtx_, nullptr);

    AVPacket* packet = av_packet_alloc();
    int ret;
    while ((ret = avcodec_receive_packet(codecCtx_, packet)) >= 0) {
        EncodeResult* result = new EncodeResult();
        result->data.assign(packet->data, packet->data + packet->size);
        result->isKeyframe = (packet->flags & AV_PKT_FLAG_KEY) != 0;
        result->pts = packet->pts;
        result->duration = packet->duration;
        result->isError = false;
        result->isFlushComplete = false;
        result->hasExtradata = false;

        // CHANGE: Use NonBlockingCall instead of BlockingCall
        tsfnOutput_.NonBlockingCall(result, [](Napi::Env env, Napi::Function fn, EncodeResult* res) {
            Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(
                env, res->data.data(), res->data.size());

            fn.Call({
                buffer,
                Napi::Boolean::New(env, res->isKeyframe),
                Napi::Number::New(env, static_cast<double>(res->pts)),
                Napi::Number::New(env, static_cast<double>(res->duration)),
                env.Undefined(),
                env.Undefined()
            });

            delete res;
        });

        av_packet_unref(packet);
    }
    av_packet_free(&packet);

    // CHANGE: Use NonBlockingCall for flush callback
    if (tsfnFlush_) {
        tsfnFlush_.NonBlockingCall([](Napi::Env env, Napi::Function fn) {
            fn.Call({ env.Null() });
        });
    }

    flushPending_ = false;
    flushCV_.notify_all();
}
```

---

## Issue 2: Native Addon Loading

### Current Problem

The `src/native.ts` file uses a custom loader that manually checks paths:

```typescript
const candidates = [
  path.join(currentDir, '..', 'prebuilds', `${platform}-${arch}`, 'node-webcodecs.node'),
  path.join(currentDir, '..', 'build', 'Release', 'webcodecs_node.node'),
  // ...
];
```

This doesn't leverage `node-gyp-build`'s sophisticated prebuild discovery, which handles:
- NAPI version compatibility
- libc variants (glibc vs musl)
- Runtime detection (Node vs Electron vs Bun)

### Solution

Replace the custom loader with `node-gyp-build`:

```typescript
import nodeGypBuild from 'node-gyp-build';
import path from 'path';

let native: any;
try {
  // node-gyp-build takes the package root directory
  native = nodeGypBuild(path.join(__dirname, '..'));
} catch (error) {
  native = new Proxy({}, {
    get() {
      throw error;
    }
  });
}

export { native };
```

### Files to Modify

1. **`src/native.ts`** - Replace entire loader with node-gyp-build

### Additional Consideration

Ensure `binding.gyp` exists and has the correct target name that matches what `node-gyp-build` expects:

```json
{
  "targets": [{
    "target_name": "node-webcodecs",
    ...
  }]
}
```

---

## Implementation Order

### Phase 1: Fix Native Addon Loading (Quick Win)

1. Update `src/native.ts` to use `node-gyp-build`
2. Verify `binding.gyp` has correct target name
3. Test with: `npm run build:ts && node -e "require('./dist')"`

### Phase 2: Fix Async Flush

1. Update `native/async_encoder.cpp`:
   - Change `BlockingCall` to `NonBlockingCall` in `ProcessFlush()`

2. Update `native/async_decoder.cpp`:
   - Same changes for decoder flush

3. Rebuild native: `npm run build:native`

4. Re-enable integration tests in CI (remove the skip)

### Phase 3: Verification

1. Run unit tests: `npm test`
2. Run integration tests locally: `npm run test:integration`
3. Re-enable CI integration tests and verify they pass
4. Publish new version (0.4.1)

---

## Success Criteria

1. **Native loading**: Package works immediately after `npm install` without compilation
2. **Flush fix**: Integration tests pass in CI without hanging
3. **Serverless**: Package works in AWS Lambda, Vercel, etc. (resource-constrained environments)

---

## Risk Assessment

### Low Risk
- Native loader change is straightforward replacement

### Medium Risk
- Async flush change: `NonBlockingCall` doesn't guarantee ordering, but for flush completion that's acceptable since we only care that it completes, not timing

### Testing Required
- Run full integration test suite locally
- Test in actual serverless environment (Lambda, Vercel)
- Verify no regression in encoding/decoding quality
