package com.uniqdev.meetingrecorder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground-сервис, который пишет звук в файл независимо от того,
 * заблокирован экран или свёрнуто приложение.
 *
 * Состояния: IDLE -> RECORDING -> PAUSED -> RECORDING -> STOPPED
 */
class AudioRecordingService : Service() {

    companion object {
        const val CHANNEL_ID = "meeting_recording_channel"
        const val NOTIFICATION_ID = 42
        const val ACTION_START = "com.uniqdev.meetingrecorder.action.START"
        const val ACTION_STOP = "com.uniqdev.meetingrecorder.action.STOP"

        @Volatile
        var instance: AudioRecordingService? = null
    }

    private var recorder: MediaRecorder? = null
    private var outputFilePath: String = ""
    private var isPaused: Boolean = false

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopRecordingInternal()
                stopSelf()
            }
            else -> {
                startForeground(NOTIFICATION_ID, buildNotification("Идёт запись встречи"))
                startRecordingInternal()
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ---- Публичные методы, вызываемые из плагина ----

    fun pauseRecording(): Boolean {
        if (recorder == null || isPaused) return false
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                recorder?.pause()
                isPaused = true
                updateNotification("Запись на паузе")
                true
            } else {
                false // pause/resume недоступны ниже API 24, встречи начнутся заново при необходимости
            }
        } catch (e: Exception) {
            false
        }
    }

    fun resumeRecording(): Boolean {
        if (recorder == null || !isPaused) return false
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                recorder?.resume()
                isPaused = false
                updateNotification("Идёт запись встречи")
                true
            } else {
                false
            }
        } catch (e: Exception) {
            false
        }
    }

    fun stopRecordingAndGetPath(): String {
        stopRecordingInternal()
        return outputFilePath
    }

    // ---- Внутренняя логика ----

    private fun startRecordingInternal() {
        val fileName = "meeting-${System.currentTimeMillis()}.m4a"
        outputFilePath = "${externalCacheDir?.absolutePath ?: filesDir.absolutePath}/$fileName"

        recorder = MediaRecorder().apply {
            setAudioSource(MediaRecorder.AudioSource.MIC)
            setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            setAudioEncodingBitRate(128000)
            setAudioSamplingRate(44100)
            setOutputFile(outputFilePath)
            prepare()
            start()
        }
        isPaused = false
    }

    private fun stopRecordingInternal() {
        try {
            recorder?.apply {
                stop()
                release()
            }
        } catch (e: Exception) {
            // Recorder мог быть уже остановлен/не успел записать данные — файл проверяется на JS-стороне
        }
        recorder = null
        isPaused = false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Запись встреч",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Уведомление о фоновой записи встречи"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(text: String): Notification {
        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = PendingIntent.getActivity(
            this, 0, openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Sprut — запись встречи")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val manager = getSystemService(NotificationManager::class.java)
        manager?.notify(NOTIFICATION_ID, buildNotification(text))
    }
}
