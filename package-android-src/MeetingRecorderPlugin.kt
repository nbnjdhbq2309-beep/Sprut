package com.uniqdev.meetingrecorder

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import java.io.File

@CapacitorPlugin(
    name = "MeetingRecorder",
    permissions = [
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
class MeetingRecorderPlugin : Plugin() {

    @PluginMethod
    fun start(call: PluginCall) {
        if (getPermissionState("microphone") != com.getcapacitor.PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermsCallback")
            return
        }
        startService()
        call.resolve()
    }

    @PermissionCallback
    private fun microphonePermsCallback(call: PluginCall) {
        if (getPermissionState("microphone") == com.getcapacitor.PermissionState.GRANTED) {
            startService()
            call.resolve()
        } else {
            call.reject("Доступ к микрофону не предоставлен")
        }
    }

    @PluginMethod
    fun pause(call: PluginCall) {
        val ok = AudioRecordingService.instance?.pauseRecording() ?: false
        val ret = JSObject()
        ret.put("paused", ok)
        call.resolve(ret)
    }

    @PluginMethod
    fun resume(call: PluginCall) {
        val ok = AudioRecordingService.instance?.resumeRecording() ?: false
        val ret = JSObject()
        ret.put("resumed", ok)
        call.resolve(ret)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        val path = AudioRecordingService.instance?.stopRecordingAndGetPath() ?: ""

        val stopIntent = Intent(context, AudioRecordingService::class.java).apply {
            action = AudioRecordingService.ACTION_STOP
        }
        context.startService(stopIntent)

        val file = File(path)
        val ret = JSObject()
        ret.put("path", path)
        ret.put("exists", file.exists())
        ret.put("size", if (file.exists()) file.length() else 0)
        call.resolve(ret)
    }

    private fun startService() {
        val intent = Intent(context, AudioRecordingService::class.java).apply {
            action = AudioRecordingService.ACTION_START
        }
        ContextCompat.startForegroundService(context, intent)
    }
}
